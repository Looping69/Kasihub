// Author: Klaasvaakie ( |╲ )
import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  encoreRequest: vi.fn(),
  encoreSessionToken: vi.fn(),
  cookieGet: vi.fn(),
}));

vi.mock("@/lib/encore-client", () => {
  class EncoreRequestError extends Error {
    constructor(message: string, public status: number, public details: unknown = null) {
      super(message);
    }
  }
  return {
    ENCORE_SESSION_COOKIE: "kasihub_session",
    EncoreRequestError,
    encoreRequest: mocks.encoreRequest,
    encoreSessionToken: mocks.encoreSessionToken,
  };
});

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: mocks.cookieGet })),
}));

import { POST as buyShares } from "./shares/buy/route";
import { POST as placeOrder } from "./marketplace/order/route";
import { POST as buyRootsBank } from "./rootsbank/purchase/route";
import { GET as poolOverview, POST as distributePool } from "./admin/pool/route";
import { POST as declareDividend } from "./admin/dividends/route";

function request(path: string, body: unknown, key?: string) {
  return new NextRequest(`https://kasihub.test${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(key ? { "idempotency-key": key } : {}),
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.encoreSessionToken.mockResolvedValue("session-token");
});

describe("financial BFF contracts", () => {
  test.each([
    ["shares", buyShares, "/api/shares/buy", { memberId: "profile", phase: 1, quantity: 1 }],
    ["marketplace", placeOrder, "/api/marketplace/order", { memberId: "profile", productId: "product" }],
    ["RootsBank", buyRootsBank, "/api/rootsbank/purchase", { memberId: "profile", category: "ADULT" }],
  ])("%s mutation rejects an unauthenticated request", async (_name, handler, path, body) => {
    mocks.encoreSessionToken.mockResolvedValue(undefined);
    const response = await handler(request(path, body, "1234567890abcdef"));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthenticated" });
    expect(mocks.encoreRequest).not.toHaveBeenCalled();
  });

  test.each([
    ["shares", buyShares, "/api/shares/buy", { memberId: "profile", phase: 1, quantity: 1 }],
    ["marketplace", placeOrder, "/api/marketplace/order", { memberId: "profile", productId: "product" }],
    ["RootsBank", buyRootsBank, "/api/rootsbank/purchase", { memberId: "profile", category: "ADULT" }],
  ])("%s mutation requires an idempotency key", async (_name, handler, path, body) => {
    const response = await handler(request(path, body));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Idempotency-Key is required" });
    expect(mocks.encoreRequest).not.toHaveBeenCalled();
  });

  test("share purchase validates input and preserves the operation contract", async () => {
    const invalid = await buyShares(request("/api/shares/buy", { memberId: "profile", phase: 1, quantity: 0 }, "1234567890abcdef"));
    expect(invalid.status).toBe(400);

    mocks.encoreRequest.mockResolvedValue({
      purchaseId: "purchase", status: "completed", totalAmount: "25.50",
      bonusQuantity: 1, certificateNumber: "CERT-1", operationId: "operation",
    });
    const response = await buyShares(request("/api/shares/buy", { memberId: "profile", phase: 2, quantity: 2 }, "1234567890abcdef"));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      operationId: "operation", effectiveQuantity: 3,
      share: { id: "purchase", phase: 2, quantity: 3, totalAmount: 25.5, status: "COMPLETED" },
    });
    expect(mocks.encoreRequest).toHaveBeenCalledWith(
      "/shares/purchase",
      expect.objectContaining({ method: "POST", headers: { "Idempotency-Key": "1234567890abcdef" } }),
      "session-token",
    );
  });

  test("marketplace order validates input and forwards the stable key", async () => {
    const invalid = await placeOrder(request("/api/marketplace/order", { memberId: "profile" }, "1234567890abcdef"));
    expect(invalid.status).toBe(400);
    mocks.encoreRequest.mockResolvedValue({ operationId: "operation", status: "completed" });
    const response = await placeOrder(request("/api/marketplace/order", { memberId: "profile", productId: "product" }, "1234567890abcdef"));
    expect(await response.json()).toMatchObject({ operationId: "operation" });
  });

  test("RootsBank purchase rejects invalid categories and forwards valid requests", async () => {
    const invalid = await buyRootsBank(request("/api/rootsbank/purchase", { memberId: "profile", category: "INVALID" }, "1234567890abcdef"));
    expect(invalid.status).toBe(400);
    mocks.encoreRequest.mockResolvedValue({ operationId: "operation", status: "completed" });
    const response = await buyRootsBank(request("/api/rootsbank/purchase", { memberId: "profile", category: "PENSIONER" }, "1234567890abcdef"));
    expect(response.status).toBe(200);
  });

  test.each([
    ["pool", distributePool, "/api/admin/pool", { totalAmount: 100 }],
    ["dividend", declareDividend, "/api/admin/dividends", { amount: 100 }],
  ])("administrator %s mutation requires auth and idempotency", async (_name, handler, path, body) => {
    mocks.encoreSessionToken.mockResolvedValue(undefined);
    expect((await handler(request(path, body, "1234567890abcdef"))).status).toBe(401);
    mocks.encoreSessionToken.mockResolvedValue("admin-token");
    expect((await handler(request(path, body))).status).toBe(400);
  });

  test("administrator distributions validate positive values and forward stable keys", async () => {
    expect((await distributePool(request("/api/admin/pool", { totalAmount: 0 }, "1234567890abcdef"))).status).toBe(400);
    expect((await declareDividend(request("/api/admin/dividends", { amount: 0 }, "1234567890abcdef"))).status).toBe(400);

    mocks.encoreRequest.mockResolvedValue({ operationId: "operation", status: "completed" });
    expect((await distributePool(request("/api/admin/pool", { totalAmount: "100.25", source: "MALL" }, "1234567890abcdef"))).status).toBe(200);
    expect(mocks.encoreRequest).toHaveBeenLastCalledWith(
      "/admin/pool/distributions",
      { method: "POST", headers: { "Idempotency-Key": "1234567890abcdef" }, body: JSON.stringify({ totalAmount: 100.25, source: "MALL" }) },
      "session-token",
    );
    expect((await declareDividend(request("/api/admin/dividends", { amount: "75.50" }, "1234567890abcdef"))).status).toBe(200);
  });

  test("pool overview derives source and daily projections", async () => {
    const today = new Date().toISOString();
    mocks.encoreRequest.mockResolvedValue({
      distributions: [
        { memberId: "abcdef123456", source: "MALL", amount: 10, payoutDate: today },
        { memberId: "abcdef999999", source: "MALL", amount: 5, payoutDate: today },
      ],
      totals: { totalPaidOut: 15 }, eligibleMembers: 2,
    });
    const response = await poolOverview(new NextRequest("https://kasihub.test/api/admin/pool?limit=20"));
    const payload = await response.json();
    expect(payload.sourceBreakdown).toEqual([{ source: "MALL", amount: 15, count: 2 }]);
    expect(payload.distributions[0].member.profileNumber).toBe("KSI-ABCDEF12");
    expect(payload.dailyTrend).toHaveLength(14);
  });

  test("financial routes preserve Encore failure status codes", async () => {
    const { EncoreRequestError } = await import("@/lib/encore-client");
    mocks.encoreRequest.mockRejectedValue(new EncoreRequestError("conflict", 409, null));
    expect((await buyShares(request("/api/shares/buy", { memberId: "profile", phase: 1, quantity: 1 }, "1234567890abcdef"))).status).toBe(409);
    expect((await placeOrder(request("/api/marketplace/order", { memberId: "profile", productId: "product" }, "1234567890abcdef"))).status).toBe(409);
    expect((await buyRootsBank(request("/api/rootsbank/purchase", { memberId: "profile", category: "ADULT" }, "1234567890abcdef"))).status).toBe(409);
    expect((await distributePool(request("/api/admin/pool", { totalAmount: 10 }, "1234567890abcdef"))).status).toBe(409);
    expect((await declareDividend(request("/api/admin/dividends", { amount: 10 }, "1234567890abcdef"))).status).toBe(409);
    expect((await poolOverview(new NextRequest("https://kasihub.test/api/admin/pool"))).status).toBe(409);
  });
});
