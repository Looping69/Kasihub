// Author: Klaasvaakie ( |╲ )
import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ encoreRequest: vi.fn(), presaleSessionToken: vi.fn() }));

vi.mock("@/lib/encore-client", () => {
  class EncoreRequestError extends Error {
    constructor(message: string, public status: number, public details: unknown = null) { super(message); }
  }
  return {
    ENCORE_SESSION_COOKIE: "kasihub_session",
    PRESALE_SESSION_COOKIE: "kasishares_session",
    EncoreRequestError,
    encoreRequest: mocks.encoreRequest,
    presaleSessionToken: mocks.presaleSessionToken,
  };
});

import { POST as login } from "./auth/login/route";
import { POST as logout } from "./auth/logout/route";
import { GET as portal } from "./portal/route";
import { POST as progress } from "./progress/route";
import { POST as openEcosystemAccount } from "./ecosystem-account/route";

function request(path: string, body: unknown) {
  return new NextRequest(`https://shares.kasihub.net${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.KASISHARES_TEST_INVITE_URL;
  mocks.presaleSessionToken.mockResolvedValue("presale-token");
});

describe("KaSiShares applicant BFF routes", () => {
  test("login sets the isolated session cookie without exposing the bearer token", async () => {
    mocks.encoreRequest.mockResolvedValue({ token: "secret-token", profileId: "profile-1", profileNumber: "KSI-ONE" });
    const body = { email: "buyer@example.test", password: "strong-password" };
    const response = await login(request("/api/presale/auth/login", body));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ profileId: "profile-1", profileNumber: "KSI-ONE" });
    expect(response.headers.get("set-cookie")).toContain("kasishares_session=secret-token");
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(mocks.encoreRequest).toHaveBeenCalledWith("/presale/auth/login", {
      method: "POST",
      body: JSON.stringify(body),
    });
  });

  test("login returns a bounded authentication error", async () => {
    const { EncoreRequestError } = await import("@/lib/encore-client");
    mocks.encoreRequest.mockRejectedValue(new EncoreRequestError("upstream detail", 401, null));
    const response = await login(request("/api/presale/auth/login", {}));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "The email or password is incorrect." });
  });

  test("portal fails closed without a presale session and forwards only with one", async () => {
    mocks.presaleSessionToken.mockResolvedValueOnce(undefined);
    expect((await portal()).status).toBe(401);
    expect(mocks.encoreRequest).not.toHaveBeenCalled();

    const payload = { applicant: { profileNumber: "KSI-ONE" }, application: null };
    mocks.encoreRequest.mockResolvedValue(payload);
    const response = await portal();
    expect(await response.json()).toEqual(payload);
    expect(mocks.encoreRequest).toHaveBeenCalledWith("/presale/applicant/portal", {}, "presale-token");
  });

  test("portal hides upstream authorization details", async () => {
    const { EncoreRequestError } = await import("@/lib/encore-client");
    mocks.encoreRequest.mockRejectedValue(new EncoreRequestError("role missing", 403, null));
    const response = await portal();
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "KaSiShares login is required" });
  });

  test("portal adds the temporary test invitation only after session authorization", async () => {
    process.env.KASISHARES_TEST_INVITE_URL = "https://shares.kasihub.net/?invite=" + "a".repeat(72);
    mocks.encoreRequest.mockResolvedValue({ applicant: { profileNumber: "KSI-ONE" }, application: null });

    const response = await portal();
    expect(await response.json()).toEqual({
      applicant: { profileNumber: "KSI-ONE" },
      application: null,
      testInviteUrl: "https://shares.kasihub.net/?invite=" + "a".repeat(72),
    });
  });

  test("progress requires the isolated session and forwards the validated body", async () => {
    mocks.presaleSessionToken.mockResolvedValueOnce(undefined);
    expect((await progress(request("/api/presale/progress", { phaseCompleted: 2 }))).status).toBe(401);

    mocks.encoreRequest.mockResolvedValue({ phaseCompleted: 2, completionPercent: 40 });
    const response = await progress(request("/api/presale/progress", { phaseCompleted: 2 }));
    expect(response.status).toBe(200);
    expect(mocks.encoreRequest).toHaveBeenCalledWith("/presale/applicant/progress", {
      method: "POST",
      body: JSON.stringify({ phaseCompleted: 2 }),
    }, "presale-token");
  });

  test("opens an ecosystem session for an issued shareholder without exposing its token", async () => {
    mocks.encoreRequest.mockResolvedValue({
      token: "ecosystem-secret",
      profileId: "profile-1",
      profileNumber: "KSI-ONE",
      subscription: { id: "sub-1", paymentId: "pay-1", status: "pending", planName: "Individual Local", amount: 140, currency: "ZAR" },
    });
    const response = await openEcosystemAccount();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      profileId: "profile-1",
      profileNumber: "KSI-ONE",
      subscription: { id: "sub-1", paymentId: "pay-1", status: "pending", planName: "Individual Local", amount: 140, currency: "ZAR" },
      redirectTo: "/",
    });
    expect(response.headers.get("set-cookie")).toContain("kasihub_session=ecosystem-secret");
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(mocks.encoreRequest).toHaveBeenCalledWith(
      "/presale/shareholder/ecosystem-account",
      { method: "POST" },
      "presale-token",
    );
  });

  test("fails closed when ecosystem conversion has no presale session", async () => {
    mocks.presaleSessionToken.mockResolvedValueOnce(undefined);
    const response = await openEcosystemAccount();
    expect(response.status).toBe(401);
    expect(mocks.encoreRequest).not.toHaveBeenCalled();
  });

  test("logout revokes the backend session and always clears the browser cookie", async () => {
    mocks.encoreRequest.mockRejectedValue(new Error("temporary upstream failure"));
    const response = await logout();
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("kasishares_session=");
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(mocks.encoreRequest).toHaveBeenCalledWith("/presale/auth/logout", { method: "POST" }, "presale-token");
  });
});
