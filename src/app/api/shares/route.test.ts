import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ encoreRequest: vi.fn(), encoreSessionToken: vi.fn() }));

vi.mock("@/lib/encore-client", () => {
  class EncoreRequestError extends Error {
    constructor(message: string, public status: number, public details: unknown = null) { super(message); }
  }
  return { EncoreRequestError, encoreRequest: mocks.encoreRequest, encoreSessionToken: mocks.encoreSessionToken };
});

import { GET } from "./route";

const phase = {
  id: "phase-2", phaseNumber: 2, quantityAvailable: 90, totalShares: 100,
  pricePerShare: "40.00", currency: "USD", status: "active", bonusBuyOneGet: false,
  createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.encoreSessionToken.mockResolvedValue("ecosystem-token");
});

describe("member shares gateway", () => {
  test("fails closed without a member session or profile", async () => {
    mocks.encoreSessionToken.mockResolvedValueOnce(undefined);
    expect((await GET(new NextRequest("https://example.test/api/shares?memberId=profile-1"))).status).toBe(401);
    expect(mocks.encoreRequest).not.toHaveBeenCalled();

    expect((await GET(new NextRequest("https://example.test/api/shares"))).status).toBe(400);
    expect(mocks.encoreRequest).not.toHaveBeenCalled();
  });

  test("returns certificate-linked portfolio values without caching private data", async () => {
    mocks.encoreRequest.mockImplementation(async (path: string) => path === "/shares/phases"
      ? { phases: [phase] }
      : { certificates: [{
        certificateNumber: "SOL-P2-001", totalShares: 3, paidShares: 3, bonusShares: 0,
        phaseNumber: 2, purchaseTotalAmount: 120, issuePricePerShare: 40,
        status: "issued", issuedAt: "2026-02-01T00:00:00.000Z", revokedAt: null,
      }] });

    const response = await GET(new NextRequest("https://example.test/api/shares?memberId=profile%2Fone"));
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(payload.activeShares[0]).toMatchObject({ phase: 2, paidShares: 3, totalAmount: 120 });
    expect(payload.phases[0]).toMatchObject({ totalShares: 100, soldShares: 10 });
    expect(mocks.encoreRequest).toHaveBeenCalledWith("/shares/me/profile%2Fone", {}, "ecosystem-token");
  });

  test("preserves authorization status while returning a bounded error", async () => {
    const { EncoreRequestError } = await import("@/lib/encore-client");
    mocks.encoreRequest.mockRejectedValue(new EncoreRequestError("sensitive upstream detail", 403, null));
    const response = await GET(new NextRequest("https://example.test/api/shares?memberId=profile-1"));
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Your member session cannot access this share portfolio" });
  });
});
