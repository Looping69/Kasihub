// Author: Klaasvaakie ( |╲ )
import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  encoreRequest: vi.fn(),
  encoreSessionToken: vi.fn(),
}));

vi.mock("@/lib/encore-client", () => {
  class EncoreRequestError extends Error {
    constructor(message: string, public status: number, public details: unknown = null) { super(message); }
  }
  return {
    ENCORE_SESSION_COOKIE: "kasihub_session",
    EncoreRequestError,
    encoreRequest: mocks.encoreRequest,
    encoreSessionToken: mocks.encoreSessionToken,
  };
});

import { POST as register } from "./members/route";
import { GET as dashboard } from "./dashboard/route";
import { GET as matrix } from "./matrix/route";

function post(body: unknown) {
  return new NextRequest("https://kasihub.test/api/members", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });
}

const member = {
  id: "profile", profileNumber: "KSI-1", membershipType: "INDIVIDUAL_ADULT",
  firstName: "Test", lastName: "Member", email: "member@example.test", isAdmin: false,
  monthlyEarnings: 10, taxThreshold: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.encoreSessionToken.mockResolvedValue("token");
});

describe("registration and dashboard contracts", () => {
  test("registration rejects incomplete requests", async () => {
    const response = await register(post({ email: "member@example.test" }));
    expect(response.status).toBe(400);
    expect(mocks.encoreRequest).not.toHaveBeenCalled();
  });

  test("registration uses the server-authoritative coordinator and returns durable routing state", async () => {
    mocks.encoreRequest
      .mockResolvedValueOnce({
        registrationId: "registration",
        status: "kyc_pending",
        nextAction: "kyc",
        routing: { kycRail: "kasihub_international", paymentRail: "usdt" },
        user: { profileId: "profile", profileNumber: "KSI-1" },
      })
      .mockResolvedValueOnce({ token: "token" })
      .mockResolvedValueOnce({ member });
    const response = await register(post({
      email: "member@example.test",
      password: "strong-password",
      membershipType: "INDIVIDUAL_ADULT",
      citizenshipType: "FOREIGN_CITIZEN_ABROAD",
      firstName: "Test",
      lastName: "Member",
      profileType: "company",
      membershipPlanCode: "COMPANY_LOCAL",
      createKyc: false,
      instapayVerifiedAt: "2026-01-01T00:00:00.000Z",
      instapayAccountRef: "forged-ref",
    }));
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      registrationId: "registration",
      status: "kyc_pending",
      nextAction: "kyc",
      routing: { kycRail: "kasihub_international", paymentRail: "usdt" },
    });
    expect(response.headers.get("set-cookie")).toContain("kasihub_session=token");
    expect(mocks.encoreRequest.mock.calls[0][0]).toBe("/registration/secure-start");

    const forwarded = JSON.parse(mocks.encoreRequest.mock.calls[0][1].body as string);
    expect(forwarded).toMatchObject({
      membershipType: "INDIVIDUAL_ADULT",
      citizenshipType: "FOREIGN_CITIZEN_ABROAD",
    });
    expect(forwarded).not.toHaveProperty("profileType");
    expect(forwarded).not.toHaveProperty("membershipPlanCode");
    expect(forwarded).not.toHaveProperty("createKyc");
    expect(forwarded).not.toHaveProperty("instapayVerifiedAt");
    expect(forwarded).not.toHaveProperty("instapayAccountRef");
  });

  test("registration maps identity conflicts without leaking upstream details", async () => {
    const { EncoreRequestError } = await import("@/lib/encore-client");
    mocks.encoreRequest.mockRejectedValue(new EncoreRequestError("duplicate identity", 409, null));
    const response = await register(post({
      email: "member@example.test",
      password: "strong-password",
      membershipType: "COMPANY",
      citizenshipType: "INTL_COMPANY",
    }));
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "A member with these identity details already exists." });
  });

  test("dashboard requires member identity and authentication", async () => {
    expect((await dashboard(new NextRequest("https://kasihub.test/api/dashboard"))).status).toBe(400);
    mocks.encoreSessionToken.mockResolvedValue(undefined);
    expect((await dashboard(new NextRequest("https://kasihub.test/api/dashboard?memberId=profile"))).status).toBe(401);
  });

  test("dashboard rejects identity drift", async () => {
    mocks.encoreRequest
      .mockResolvedValueOnce({
        profile: { member: { ...member, id: "different" } },
        wallet: { balance: "0", currency: "ZAR", transactions: [] },
        matrix: { nodes: [] }, shares: { certificates: [] }, phases: { phases: [] },
      })
      .mockResolvedValueOnce({ distributions: [], pools: {} })
      .mockResolvedValueOnce({ pioneerCount: 0, myShare: null });
    const response = await dashboard(new NextRequest("https://kasihub.test/api/dashboard?memberId=profile"));
    expect(response.status).toBe(403);
  });

  test("dashboard composes authoritative database projections instead of placeholder zeros", async () => {
    const now = new Date().toISOString();
    mocks.encoreRequest
      .mockResolvedValueOnce({
        profile: { member },
        wallet: {
          balance: "125.50",
          currency: "ZAR",
          transactions: [
            { id: "opening", type: "OPENING_BALANCE", amount: 100, description: "Opening", status: "COMPLETED", createdAt: now },
            { id: "pool", type: "POOL_PAYOUT", amount: 25.5, description: "Pool earning", status: "COMPLETED", createdAt: now },
            { id: "matrix", type: "MATRIX_PAYOUT", amount: 13, description: "Level 1", status: "COMPLETED", createdAt: now },
          ],
        },
        matrix: { nodes: [{ depth: 0 }, { depth: 2 }] },
        shares: { certificates: [{ totalShares: 3, status: "issued" }, { totalShares: 50, status: "revoked" }] },
        phases: { phases: [{ phaseNumber: 1, pricePerShare: "20", status: "active" }] },
      })
      .mockResolvedValueOnce({
        distributions: [{ id: "distribution", amount: 25.5, source: "MARKETPLACE", poolType: "MARKETPLACE", status: "PAID", payoutDate: now }],
        pools: {
          MARKETPLACE: {
            total: 25.5,
            today: 25.5,
            distributions: [{ id: "distribution", amount: 25.5, source: "MARKETPLACE", poolType: "MARKETPLACE", status: "PAID", payoutDate: now }],
          },
        },
      })
      .mockResolvedValueOnce({
        pioneerCount: 1,
        myShare: { sharePrice: 500, totalAmount: 700, pioneerPool: true, status: "ACTIVE" },
      });

    const response = await dashboard(new NextRequest("https://kasihub.test/api/dashboard?memberId=profile"));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      walletBalance: 125.5,
      walletCurrency: "ZAR",
      totalEarnings: 38.5,
      earningsToday: 38.5,
      ecosystemEarningsToday: 13,
      ecosystemDownline: 1,
      ecosystemLevels: 2,
      pools: { marketplace: { total: 25.5, today: 25.5 } },
      kasiShares: { count: 3, valuePerShare: 20, totalValue: 60 },
      rootsBankShares: { count: 1, totalValue: 500 },
      pioneerPoolEligible: true,
    });
    expect(mocks.encoreRequest.mock.calls.map((call) => call[0])).toEqual([
      "/dashboard/profile",
      "/finance/me/profile/summary",
      "/rootsbank/profile",
    ]);
  });

  test("matrix returns an empty tester-safe ecosystem while placement is pending", async () => {
    mocks.encoreRequest.mockResolvedValueOnce({ nodes: [] });
    const response = await matrix(new NextRequest("https://kasihub.test/api/matrix?memberId=profile"));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      placementStatus: "pending",
      tree: { id: "profile", isMe: true, children: [] },
      myLevel: 0,
      myNodeIndex: 0,
    });
  });
});
