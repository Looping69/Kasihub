// Author: Klaasvaakie ( |╲ )
import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";
import { EncoreRequestError } from "@/lib/encore-client";

const mocks = vi.hoisted(() => ({
  encoreRequest: vi.fn(),
  encoreSessionToken: vi.fn(),
}));

vi.mock("@/lib/encore-client", () => {
  class EncoreRequestError extends Error {
    constructor(message: string, public status: number, public details: unknown = null) {
      super(message);
    }
  }
  return {
    EncoreRequestError,
    encoreRequest: mocks.encoreRequest,
    encoreSessionToken: mocks.encoreSessionToken,
    presaleSessionToken: mocks.encoreSessionToken,
  };
});

import { GET as listCampaigns, POST as saveCampaign } from "./admin/presale/campaigns/route";
import { POST as prepareBatch } from "./admin/presale/incorporation-batches/route";
import { POST as applyBatch } from "./admin/presale/incorporation-batches/[batchId]/apply/route";
import { POST as createInvitation } from "./admin/presale/invitations/route";
import { GET as listOrders } from "./admin/presale/orders/route";
import { GET as listAvailableCampaigns } from "./presale/campaigns/route";
import { GET as getOffer } from "./presale/offer/route";
import { POST as createOrder } from "./presale/orders/route";
import { POST as uploadKycDocument } from "./presale/kyc-documents/route";
import { GET as getKycVerification } from "./presale/kyc-status/route";
import { POST as createKycSession } from "./presale/kyc-session/route";
import { GET as getOrder } from "./presale/orders/[reference]/route";
import { POST as cancelOrder } from "./presale/orders/[reference]/cancel/route";
import { POST as submitProof } from "./presale/orders/[reference]/payment-proof/route";
import { POST as startWebPayCheckout } from "./presale/orders/[reference]/webpay-checkout/route";
import { POST as receiveWebPayNotification } from "./presale/webpay/notify/route";
import { POST as receiveWebPayProcessNotification } from "./presale/webpay/process/route";

function request(path: string, init: RequestInit = {}) {
  return new NextRequest(`https://kasihub.test${path}`, init as ConstructorParameters<typeof NextRequest>[1]);
}

function jsonPost(path: string, body: unknown, headers: Record<string, string> = {}) {
  return request(path, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

const batchContext = { params: Promise.resolve({ batchId: "batch/id" }) };
const orderContext = { params: Promise.resolve({ reference: "KSP/ORDER 1" }) };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.encoreSessionToken.mockResolvedValue("admin-token");
  mocks.encoreRequest.mockResolvedValue({ ok: true });
});

describe("presale BFF contracts", () => {
  test.each([
    ["campaign list", () => listCampaigns(), "/admin/presale/campaigns", {}],
    ["campaign save", () => saveCampaign(jsonPost("/api/admin/presale/campaigns", { priceUsd: 25 })), "/admin/presale/campaigns", { method: "POST", body: JSON.stringify({ priceUsd: 25 }) }],
    ["incorporation prepare", () => prepareBatch(jsonPost("/api/admin/presale/incorporation-batches", { campaignId: "campaign" })), "/admin/presale/incorporation-batches", { method: "POST", body: JSON.stringify({ campaignId: "campaign" }) }],
    ["incorporation apply", () => applyBatch(jsonPost("/api/admin/presale/incorporation-batches/batch/apply", {}), batchContext), "/admin/presale/incorporation-batches/batch%2Fid/apply", { method: "POST" }],
    ["invitation create", () => createInvitation(jsonPost("/api/admin/presale/invitations", { email: "buyer@example.test" })), "/admin/presale/invitations", { method: "POST", body: JSON.stringify({ email: "buyer@example.test" }) }],
    ["order list", () => listOrders(request("/api/admin/presale/orders?campaignId=campaign&status=confirmed&limit=25&ignored=x")), "/admin/presale/orders?campaignId=campaign&status=confirmed&limit=25", {}],
  ])("authenticated administrator %s forwards its exact backend contract", async (_name, handler, path, init) => {
    const response = await handler();
    expect(response.status).toBe(200);
    expect(mocks.encoreRequest).toHaveBeenCalledWith(path, init, "admin-token");
  });

  test.each([
    ["campaign list", () => listCampaigns()],
    ["campaign save", () => saveCampaign(jsonPost("/api/admin/presale/campaigns", {}))],
    ["incorporation prepare", () => prepareBatch(jsonPost("/api/admin/presale/incorporation-batches", {}))],
    ["incorporation apply", () => applyBatch(jsonPost("/api/admin/presale/incorporation-batches/batch/apply", {}), batchContext)],
    ["invitation create", () => createInvitation(jsonPost("/api/admin/presale/invitations", {}))],
    ["order list", () => listOrders(request("/api/admin/presale/orders"))],
  ])("administrator %s rejects requests without a session", async (_name, handler) => {
    mocks.encoreSessionToken.mockResolvedValue(undefined);
    const response = await handler();
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthenticated" });
    expect(mocks.encoreRequest).not.toHaveBeenCalled();
  });

  test("public campaign and invite endpoints enforce their access boundaries", async () => {
    await listAvailableCampaigns();
    expect(mocks.encoreRequest).toHaveBeenLastCalledWith("/presale/campaigns");

    const missingInvite = await getOffer(request("/api/presale/offer"));
    expect(missingInvite.status).toBe(403);
    expect(mocks.encoreRequest).toHaveBeenCalledTimes(1);

    await getOffer(request("/api/presale/offer?invite= invite%2Ftoken "));
    expect(mocks.encoreRequest).toHaveBeenLastCalledWith("/presale/offer?inviteToken=invite%2Ftoken");
  });

  test("order creation requires idempotency and preserves the stable key", async () => {
    const missingKey = await createOrder(jsonPost("/api/presale/orders", { quantity: 1 }));
    expect(missingKey.status).toBe(400);
    expect(mocks.encoreRequest).not.toHaveBeenCalled();

    await createOrder(jsonPost("/api/presale/orders", { quantity: 2 }, { "idempotency-key": "stable-key" }));
    expect(mocks.encoreRequest).toHaveBeenCalledWith(
      "/presale/orders",
      { method: "POST", headers: { "Idempotency-Key": "stable-key" }, body: JSON.stringify({ quantity: 2 }) },
      "admin-token",
    );
  });

  test("order creation fails closed when the buyer is not signed in", async () => {
    mocks.encoreSessionToken.mockResolvedValue(undefined);
    const response = await createOrder(jsonPost("/api/presale/orders", { quantity: 2 }, { "idempotency-key": "stable-key" }));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Sign in to create a presale reservation" });
    expect(mocks.encoreRequest).not.toHaveBeenCalled();
  });

  test("order creation exposes only safe upstream validation messages", async () => {
    const { EncoreRequestError } = await import("@/lib/encore-client");
    mocks.encoreRequest.mockRejectedValue(new EncoreRequestError("failed", 400, { message: "International KYC verification is required (PENDING)" }));
    const response = await createOrder(jsonPost("/api/presale/orders", { quantity: 2 }, { "idempotency-key": "stable-key" }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "International KYC verification is required (PENDING)" });
  });

  test("identity evidence upload is session-bound and forwarded to the private KYC case", async () => {
    mocks.encoreRequest
      .mockResolvedValueOnce({ member: { id: "profile-1" } })
      .mockResolvedValueOnce({ id: "case-1" })
      .mockResolvedValueOnce({ id: "document-1", status: "uploaded", duplicate: false });
    const body = new FormData();
    body.set("documentType", "identity_selfie");
    body.set("file", new File([new Uint8Array([0xff, 0xd8, 0xff])], "selfie.jpg", { type: "image/jpeg" }));
    const response = await uploadKycDocument(request("/api/presale/kyc-documents", { method: "POST", body }));

    expect(response.status).toBe(201);
    expect(mocks.encoreRequest).toHaveBeenNthCalledWith(1, "/profiles/me", {}, "admin-token");
    expect(mocks.encoreRequest).toHaveBeenNthCalledWith(2, "/kyc/international/cases", {
      method: "POST",
      body: JSON.stringify({ profileId: "profile-1" }),
    }, "admin-token");
    expect(mocks.encoreRequest).toHaveBeenNthCalledWith(3, "/kyc/international/cases/case-1/documents", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ "Content-Type": "image/jpeg", "X-Document-Type": "identity_selfie" }),
    }), "admin-token");
  });

  test("identity verification polling is session-bound to the signed-in profile", async () => {
    mocks.encoreRequest
      .mockResolvedValueOnce({ member: { id: "profile/1" } })
      .mockResolvedValueOnce({ required: true, verified: false, status: "PENDING", caseId: "case-1" });

    const response = await getKycVerification();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      verification: { required: true, verified: false, status: "PENDING", caseId: "case-1" },
    });
    expect(mocks.encoreRequest).toHaveBeenNthCalledWith(1, "/profiles/me", {}, "admin-token");
    expect(mocks.encoreRequest).toHaveBeenNthCalledWith(2, "/kyc/international/status/profile%2F1", {}, "admin-token");
  });

  test("Didit session creation is bound to the signed-in profile and KYC case", async () => {
    mocks.encoreRequest
      .mockResolvedValueOnce({ member: { id: "profile-1" } })
      .mockResolvedValueOnce({ id: "case/1" })
      .mockResolvedValueOnce({ sessionId: "session-1", url: "https://verify.didit.me/session/token", status: "Not Started" });

    const response = await createKycSession();

    expect(response.status).toBe(200);
    expect(mocks.encoreRequest).toHaveBeenNthCalledWith(2, "/kyc/international/cases", {
      method: "POST", body: JSON.stringify({ profileId: "profile-1" }),
    }, "admin-token");
    expect(mocks.encoreRequest).toHaveBeenNthCalledWith(3, "/kyc/international/cases/case%2F1/didit-session", { method: "POST" }, "admin-token");
  });

  test("Didit session failures preserve a bounded safe provider reason", async () => {
    mocks.encoreSessionToken.mockResolvedValue("admin-token");
    mocks.encoreRequest
      .mockResolvedValueOnce({ member: { id: "profile-1" } })
      .mockResolvedValueOnce({ id: "case-1" })
      .mockRejectedValueOnce(new EncoreRequestError("Encore request failed with 503", 503, {
        message: "Identity verification provider credentials were rejected",
      }));

    const { POST } = await import("./presale/kyc-session/route");
    const response = await POST();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "Identity verification provider credentials were rejected",
    });
  });

  test("identity evidence upload rejects unauthenticated and invalid selfie files", async () => {
    mocks.encoreSessionToken.mockResolvedValue(undefined);
    const unauthenticated = await uploadKycDocument(request("/api/presale/kyc-documents", { method: "POST", body: new FormData() }));
    expect(unauthenticated.status).toBe(401);

    mocks.encoreSessionToken.mockResolvedValue("member-token");
    const body = new FormData();
    body.set("documentType", "identity_selfie");
    body.set("file", new File(["%PDF-"], "selfie.pdf", { type: "application/pdf" }));
    const invalid = await uploadKycDocument(request("/api/presale/kyc-documents", { method: "POST", body }));
    expect(invalid.status).toBe(400);
    expect(mocks.encoreRequest).not.toHaveBeenCalled();
  });

  test("order access credentials stay in headers and never enter URLs", async () => {
    mocks.encoreSessionToken.mockResolvedValueOnce(undefined);
    const missingToken = await getOrder(request("/api/presale/orders/KSP-ORDER-1"), orderContext);
    expect(missingToken.status).toBe(401);
    expect(mocks.encoreRequest).not.toHaveBeenCalled();

    mocks.encoreSessionToken.mockResolvedValueOnce(undefined);
    await getOrder(request("/api/presale/orders/KSP-ORDER-1", { headers: { "x-presale-access-token": " private-token " } }), orderContext);
    expect(mocks.encoreRequest).toHaveBeenCalledWith(
      "/presale/orders/KSP%2FORDER%201",
      { headers: { "X-Presale-Access-Token": "private-token" } },
      undefined,
    );
  });

  test("payment proof pins the order reference instead of trusting client input", async () => {
    await submitProof(jsonPost("/api/presale/orders/KSP-ORDER-1/payment-proof", { orderReference: "attacker", transactionHash: "tx" }), orderContext);
    expect(mocks.encoreRequest).toHaveBeenCalledWith(
      "/presale/orders/KSP%2FORDER%201/payment-proof",
      { method: "POST", body: JSON.stringify({ orderReference: "KSP/ORDER 1", transactionHash: "tx" }) },
      "admin-token",
    );
  });

  test("payment proof fails closed without a signed-in member session", async () => {
    mocks.encoreSessionToken.mockResolvedValue(undefined);
    const response = await submitProof(jsonPost("/api/presale/orders/KSP/payment-proof", { txHash: "abc123" }), orderContext);
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Authentication is required" });
    expect(mocks.encoreRequest).not.toHaveBeenCalled();
  });

  test("unpaid reservation cancellation is session-bound and pins the route reference", async () => {
    mocks.encoreSessionToken.mockResolvedValueOnce(undefined);
    const unauthenticated = await cancelOrder(
      jsonPost("/api/presale/orders/KSP/cancel", { acknowledgeNoPaymentSent: true }),
      orderContext,
    );
    expect(unauthenticated.status).toBe(401);
    expect(mocks.encoreRequest).not.toHaveBeenCalled();

    const response = await cancelOrder(
      jsonPost("/api/presale/orders/KSP/cancel", { acknowledgeNoPaymentSent: true }),
      orderContext,
    );
    expect(response.status).toBe(200);
    expect(mocks.encoreRequest).toHaveBeenCalledWith(
      "/presale/orders/KSP%2FORDER%201/cancel",
      { method: "POST", body: JSON.stringify({ acknowledgeNoPaymentSent: true }) },
      "admin-token",
    );
  });

  test("reservation cancellation safely maps stale and unexpected failures", async () => {
    const { EncoreRequestError } = await import("@/lib/encore-client");
    mocks.encoreRequest.mockRejectedValueOnce(new EncoreRequestError("stale", 409, null));
    const stale = await cancelOrder(request("/api/presale/orders/KSP/cancel", { method: "POST", body: "not-json" }), orderContext);
    expect(stale.status).toBe(409);
    expect(await stale.json()).toEqual({
      error: "This reservation has already expired, changed status, or entered WebPay checkout. Your account status will be refreshed.",
    });

    mocks.encoreRequest.mockRejectedValueOnce(new Error("network unavailable"));
    const failed = await cancelOrder(jsonPost("/api/presale/orders/KSP/cancel", {}), orderContext);
    expect(failed.status).toBe(500);
    expect(await failed.json()).toEqual({ error: "The unpaid reservation could not be cancelled." });
  });

  test("WebPay checkout requires the private order token and preserves it in a header", async () => {
    mocks.encoreSessionToken.mockResolvedValueOnce(undefined);
    const missing = await startWebPayCheckout(request("/api/presale/orders/KSP/webpay-checkout", { method: "POST" }), orderContext);
    expect(missing.status).toBe(401);
    expect(mocks.encoreRequest).not.toHaveBeenCalled();

    mocks.encoreSessionToken.mockResolvedValueOnce(undefined);
    const response = await startWebPayCheckout(request("/api/presale/orders/KSP/webpay-checkout", {
      method: "POST",
      headers: { "x-presale-access-token": " private-token " },
    }), orderContext);
    expect(response.status).toBe(200);
    expect(mocks.encoreRequest).toHaveBeenCalledWith(
      "/presale/orders/KSP%2FORDER%201/webpay-checkout",
      { method: "POST", headers: { "X-Presale-Access-Token": "private-token" } },
      undefined,
    );
  });

  test("WebPay checkout supports session authentication when order access token is omitted", async () => {
    mocks.encoreSessionToken.mockResolvedValue("session-token");
    const response = await startWebPayCheckout(request("/api/presale/orders/KSP/webpay-checkout", {
      method: "POST",
    }), orderContext);
    expect(response.status).toBe(200);
    expect(mocks.encoreRequest).toHaveBeenCalledWith(
      "/presale/orders/KSP%2FORDER%201/webpay-checkout",
      { method: "POST", headers: {} },
      "session-token",
    );
  });

  test("WebPay checkout distinguishes unavailable configuration from internal failure", async () => {
    const { EncoreRequestError } = await import("@/lib/encore-client");
    const req = () => request("/api/presale/orders/KSP/webpay-checkout", {
      method: "POST",
      headers: { "x-presale-access-token": "private-token" },
    });
    mocks.encoreRequest.mockRejectedValueOnce(new EncoreRequestError("missing", 503, null));
    const unavailable = await startWebPayCheckout(req(), orderContext);
    expect(await unavailable.json()).toEqual({ error: "WebPay checkout is not configured" });

    mocks.encoreRequest.mockRejectedValueOnce(new Error("network unavailable"));
    const failed = await startWebPayCheckout(req(), orderContext);
    expect(failed.status).toBe(500);
    expect(await failed.json()).toEqual({ error: "Unable to start WebPay checkout" });
  });

  test.each([
    ["payment", receiveWebPayNotification, "/presale/webhooks/webpay", 32_768],
    ["process", receiveWebPayProcessNotification, "/presale/webhooks/webpay-process", 16_384],
  ] as const)("WebPay %s callback accepts JSON and form payloads but rejects invalid bodies", async (_name, handler, backendPath, limit) => {
    const jsonResponse = await handler(request("/api/presale/webpay/callback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reference: "KSP-1", status: "COMPLETE" }),
    }));
    expect(jsonResponse.status).toBe(200);
    expect(mocks.encoreRequest).toHaveBeenLastCalledWith(backendPath, {
      method: "POST",
      body: JSON.stringify({ reference: "KSP-1", status: "COMPLETE" }),
    });

    await handler(request("/api/presale/webpay/callback", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "reference=KSP-1&status=FAILED",
    }));
    expect(mocks.encoreRequest).toHaveBeenLastCalledWith(backendPath, {
      method: "POST",
      body: JSON.stringify({ reference: "KSP-1", status: "FAILED" }),
    });

    const empty = await handler(request("/api/presale/webpay/callback", { method: "POST", body: "" }));
    expect(empty.status).toBe(400);
    const oversized = await handler(request("/api/presale/webpay/callback", { method: "POST", body: "x".repeat(limit + 1) }));
    expect(oversized.status).toBe(400);
    const unsupported = await handler(request("/api/presale/webpay/callback", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "reference=KSP-1",
    }));
    expect(unsupported.status).toBe(400);
  });

  test("WebPay callbacks preserve bounded upstream status codes", async () => {
    const { EncoreRequestError } = await import("@/lib/encore-client");
    mocks.encoreRequest.mockRejectedValueOnce(new EncoreRequestError("invalid checksum", 401, null));
    const payment = await receiveWebPayNotification(jsonPost("/api/presale/webpay/notify", { reference: "KSP-1" }));
    expect(payment.status).toBe(401);
    expect(await payment.json()).toEqual({ error: "WebPay notification rejected" });

    mocks.encoreRequest.mockRejectedValueOnce(new EncoreRequestError("invalid checksum", 403, null));
    const process = await receiveWebPayProcessNotification(jsonPost("/api/presale/webpay/process", { reference: "KSP-1" }));
    expect(process.status).toBe(403);
    expect(await process.json()).toEqual({ error: "WebPay process notification rejected" });
  });

  test("all presale routes preserve safe Encore failure statuses", async () => {
    const { EncoreRequestError } = await import("@/lib/encore-client");
    mocks.encoreRequest.mockRejectedValue(new EncoreRequestError("forbidden", 403, null));
    expect((await saveCampaign(jsonPost("/api/admin/presale/campaigns", {}))).status).toBe(403);
    expect((await getOffer(request("/api/presale/offer?invite=token"))).status).toBe(403);
    expect((await createOrder(jsonPost("/api/presale/orders", {}, { "idempotency-key": "stable-key" }))).status).toBe(403);
    expect((await getOrder(request("/api/presale/orders/KSP", { headers: { "x-presale-access-token": "token" } }), orderContext)).status).toBe(403);
    expect((await submitProof(jsonPost("/api/presale/orders/KSP/payment-proof", {}), orderContext)).status).toBe(403);
  });

  test("campaign save exposes a bounded backend validation message", async () => {
    const { EncoreRequestError } = await import("@/lib/encore-client");
    mocks.encoreRequest.mockRejectedValueOnce(new EncoreRequestError("invalid", 400, {
      message: "Campaign end must be after its start",
    }));

    const response = await saveCampaign(jsonPost("/api/admin/presale/campaigns", {}));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Campaign end must be after its start" });
  });

  test.each([
    ["campaign list", () => listCampaigns()],
    ["incorporation prepare", () => prepareBatch(jsonPost("/api/admin/presale/incorporation-batches", {}))],
    ["incorporation apply", () => applyBatch(jsonPost("/api/admin/presale/incorporation-batches/batch/apply", {}), batchContext)],
    ["invitation create", () => createInvitation(jsonPost("/api/admin/presale/invitations", {}))],
    ["order list", () => listOrders(request("/api/admin/presale/orders"))],
    ["public campaign list", () => listAvailableCampaigns()],
  ])("%s converts an unexpected backend failure into a safe 500 response", async (_name, handler) => {
    mocks.encoreRequest.mockRejectedValue(new Error("network unavailable"));
    const response = await handler();
    expect(response.status).toBe(500);
    expect(await response.json()).toHaveProperty("error");
  });
});
