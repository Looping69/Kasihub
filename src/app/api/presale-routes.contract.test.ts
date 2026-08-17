// Author: Klaasvaakie ( |╲ )
import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

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
import { GET as getOrder } from "./presale/orders/[reference]/route";
import { POST as submitProof } from "./presale/orders/[reference]/payment-proof/route";

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

  test("order access credentials stay in headers and never enter URLs", async () => {
    const missingToken = await getOrder(request("/api/presale/orders/KSP-ORDER-1"), orderContext);
    expect(missingToken.status).toBe(401);
    expect(mocks.encoreRequest).not.toHaveBeenCalled();

    await getOrder(request("/api/presale/orders/KSP-ORDER-1", { headers: { "x-presale-access-token": " private-token " } }), orderContext);
    expect(mocks.encoreRequest).toHaveBeenCalledWith(
      "/presale/orders/KSP%2FORDER%201",
      { headers: { "X-Presale-Access-Token": "private-token" } },
    );
  });

  test("payment proof pins the order reference instead of trusting client input", async () => {
    await submitProof(jsonPost("/api/presale/orders/KSP-ORDER-1/payment-proof", { orderReference: "attacker", transactionHash: "tx" }), orderContext);
    expect(mocks.encoreRequest).toHaveBeenCalledWith(
      "/presale/orders/KSP%2FORDER%201/payment-proof",
      { method: "POST", body: JSON.stringify({ orderReference: "KSP/ORDER 1", transactionHash: "tx" }) },
    );
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
