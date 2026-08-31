import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({ encoreRequest: vi.fn(), encoreSessionToken: vi.fn() }));

vi.mock("@/lib/encore-client", () => {
  class EncoreRequestError extends Error {
    constructor(message: string, public status: number, public details: unknown = null) { super(message); }
  }
  return { EncoreRequestError, encoreRequest: mocks.encoreRequest, encoreSessionToken: mocks.encoreSessionToken };
});

import { GET } from "./route";

const portfolio = {
  schemaVersion: "shareholder-portfolio.v2",
  asOf: "2026-08-31T00:00:00.000Z",
  ledgerRevision: "1:2026-08-31",
  summary: {
    issuedShares: 4,
    paidShares: 2,
    bonusShares: 2,
    acquisitionCost: { amount: "50.000000", currency: "USD" },
  },
  holdings: [{
    orderReference: "KSP-E2E",
    certificateNumber: "SOL-P1-001",
    certificateStatus: "issued",
    issuedAt: "2026-08-31T00:00:00.000Z",
    revokedAt: null,
    phaseNumber: 1,
    paidShares: 2,
    bonusShares: 2,
    totalShares: 4,
    distinctiveFrom: 1,
    distinctiveTo: 4,
    acquisitionCost: { amount: "50.000000", currency: "USD" },
    issuePricePerPaidShare: { amount: "25.000000", currency: "USD" },
    verificationId: "10000000-0000-4000-8000-000000000001",
  }],
  capabilities: { canApplyForMoreShares: true, applicationUrl: "/presale" },
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.encoreSessionToken.mockResolvedValue("ecosystem-token");
});

describe("session-derived member portfolio gateway", () => {
  test("does not send a browser-selected profile and keeps offers optional", async () => {
    mocks.encoreRequest.mockImplementation(async (path: string) => {
      if (path === "/shares/portfolio/me") return portfolio;
      throw new Error("optional phase service unavailable");
    });
    const response = await GET();
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(payload.activeShares[0]).toMatchObject({
      certificateNo: "SOL-P1-001",
      paidShares: 2,
      bonusShares: 2,
      totalAmount: 50,
    });
    expect(payload.totalValue).toBe(50);
    expect(payload.phases).toEqual([]);
    expect(mocks.encoreRequest).toHaveBeenCalledWith("/shares/portfolio/me", {}, "ecosystem-token");
    expect(mocks.encoreRequest.mock.calls.flat().join(" ")).not.toContain("profile");
  });

  test("fails closed without an ecosystem session", async () => {
    mocks.encoreSessionToken.mockResolvedValue(undefined);
    const response = await GET();
    expect(response.status).toBe(401);
    expect(mocks.encoreRequest).not.toHaveBeenCalled();
  });
});
