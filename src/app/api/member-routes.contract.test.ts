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

function post(body: unknown) {
  return new NextRequest("https://kasihub.test/api/members", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });
}

const member = {
  id: "profile", profileNumber: "KSI-1", membershipType: "INDIVIDUAL",
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

  test("registration resumes Encore workflow, logs in, and returns durable state", async () => {
    mocks.encoreRequest
      .mockResolvedValueOnce({ registrationId: "registration", status: "awaiting_payment", nextAction: "payment", user: { profileId: "profile", profileNumber: "KSI-1" } })
      .mockResolvedValueOnce({ token: "token" })
      .mockResolvedValueOnce({ member });
    const response = await register(post({
      email: "member@example.test", password: "strong-password", membershipType: "INDIVIDUAL",
      citizenshipType: "SA_CITIZEN", firstName: "Test", lastName: "Member",
    }));
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ registrationId: "registration", status: "awaiting_payment", nextAction: "payment" });
    expect(response.headers.get("set-cookie")).toContain("kasihub_session=token");
    expect(mocks.encoreRequest.mock.calls[0][0]).toBe("/registration/start");
  });

  test("registration maps identity conflicts without leaking upstream details", async () => {
    const { EncoreRequestError } = await import("@/lib/encore-client");
    mocks.encoreRequest.mockRejectedValue(new EncoreRequestError("duplicate identity", 409, null));
    const response = await register(post({
      email: "member@example.test", password: "strong-password", membershipType: "COMPANY",
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
      .mockResolvedValueOnce({ member: { ...member, id: "different" } })
      .mockResolvedValueOnce({ balance: "0", currency: "ZAR", transactions: [] })
      .mockResolvedValueOnce({ nodes: [] })
      .mockResolvedValueOnce({ certificates: [] })
      .mockResolvedValueOnce({ phases: [] });
    const response = await dashboard(new NextRequest("https://kasihub.test/api/dashboard?memberId=profile"));
    expect(response.status).toBe(403);
  });

  test("dashboard composes authoritative Encore projections", async () => {
    mocks.encoreRequest
      .mockResolvedValueOnce({ member })
      .mockResolvedValueOnce({ balance: "125.50", currency: "ZAR", transactions: [{ id: "transaction" }] })
      .mockResolvedValueOnce({ nodes: [{ depth: 0 }, { depth: 2 }] })
      .mockResolvedValueOnce({ certificates: [{ totalShares: 3, status: "issued" }, { totalShares: 50, status: "revoked" }] })
      .mockResolvedValueOnce({ phases: [{ phaseNumber: 1, pricePerShare: "20", status: "active" }] });
    const response = await dashboard(new NextRequest("https://kasihub.test/api/dashboard?memberId=profile"));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      totalEarnings: 125.5, ecosystemDownline: 1, ecosystemLevels: 2,
      kasiShares: { count: 3, valuePerShare: 20, totalValue: 60 },
    });
  });
});
