// Author: Klaasvaakie ( |╲ )
import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ encoreRequest: vi.fn() }));

vi.mock("@/lib/encore-client", () => {
  class EncoreRequestError extends Error {
    constructor(message: string, public status: number, public details: unknown = null) { super(message); }
  }
  return {
    PRESALE_SESSION_COOKIE: "kasishares_session",
    EncoreRequestError,
    encoreRequest: mocks.encoreRequest,
    sessionCookieOptions: () => ({ httpOnly: true, sameSite: "lax", secure: false, path: "/", maxAge: 60 * 60 * 24 * 7 }),
  };
});

import { POST } from "./route";

function request(body: unknown) {
  return new NextRequest("https://shares.kasihub.net/api/presale/members", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => vi.clearAllMocks());

describe("presale member registration bridge", () => {
  test("sets an HTTP-only session without exposing the token", async () => {
    mocks.encoreRequest.mockResolvedValue({
      token: "secret-session-token",
      profileId: "profile-1",
      profileNumber: "KSI-ONE",
      applicationId: "application-1",
      created: true,
      emailStatus: "sent",
    });
    const body = { inviteToken: "a".repeat(32), email: "buyer@example.test", password: "strong-password" };
    const response = await POST(request(body));

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ profileId: "profile-1", profileNumber: "KSI-ONE", applicationId: "application-1", created: true, emailStatus: "sent" });
    expect(response.headers.get("set-cookie")).toContain("kasishares_session=secret-session-token");
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(mocks.encoreRequest).toHaveBeenCalledWith("/presale/members", {
      method: "POST",
      body: JSON.stringify(body),
    });
  });

  test("returns bounded public errors", async () => {
    const { EncoreRequestError } = await import("@/lib/encore-client");
    mocks.encoreRequest.mockRejectedValue(new EncoreRequestError("upstream secret", 403, null));
    const response = await POST(request({}));
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "This invitation cannot be used for that email address." });
  });

  test.each([
    [409, "An account already exists for this email. Use the existing account password."],
    [412, "This account cannot currently be used for shareholder registration."],
  ])("does not disguise an upstream %i account conflict as an outage", async (status, message) => {
    const { EncoreRequestError } = await import("@/lib/encore-client");
    mocks.encoreRequest.mockRejectedValue(new EncoreRequestError("upstream detail", status, null));
    const response = await POST(request({}));
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error: message });
  });
});
