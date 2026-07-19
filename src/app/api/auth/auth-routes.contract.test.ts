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
    constructor(message: string, public status: number, public details: unknown = null) { super(message); }
  }
  return {
    ENCORE_SESSION_COOKIE: "kasihub_session",
    EncoreRequestError,
    encoreRequest: mocks.encoreRequest,
    encoreSessionToken: mocks.encoreSessionToken,
  };
});

vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({ get: mocks.cookieGet })) }));

import { POST as login } from "./login/route";
import { GET as session } from "./session/route";
import { POST as logout } from "./logout/route";

const member = { id: "profile", email: "member@example.test", isAdmin: false };

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.KASIHUB_DEMO_ADMIN_EMAIL;
  delete process.env.KASIHUB_DEMO_ADMIN_PASSWORD;
});

describe("authentication BFF contracts", () => {
  test("login validates credentials and maps invalid credentials", async () => {
    const missing = await login(new NextRequest("https://kasihub.test/api/auth/login", {
      method: "POST", body: JSON.stringify({ email: "member@example.test" }),
    }));
    expect(missing.status).toBe(400);

    const { EncoreRequestError } = await import("@/lib/encore-client");
    mocks.encoreRequest.mockRejectedValue(new EncoreRequestError("invalid", 401, null));
    const rejected = await login(new NextRequest("https://kasihub.test/api/auth/login", {
      method: "POST", body: JSON.stringify({ email: "member@example.test", password: "wrong" }),
    }));
    expect(rejected.status).toBe(401);
    expect(await rejected.json()).toEqual({ error: "Invalid email or password" });
  });

  test("successful login verifies the profile and sets an HTTP-only cookie", async () => {
    mocks.encoreRequest
      .mockResolvedValueOnce({ token: "secret-token" })
      .mockResolvedValueOnce({ member });
    const response = await login(new NextRequest("https://kasihub.test/api/auth/login", {
      method: "POST", body: JSON.stringify({ email: "member@example.test", password: "correct-password" }),
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ member });
    expect(response.headers.get("set-cookie")).toContain("kasihub_session=secret-token");
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
  });

  test("demo administrator login fails closed when configuration or role is wrong", async () => {
    const unavailable = await login(new NextRequest("https://kasihub.test/api/auth/login", {
      method: "POST", body: JSON.stringify({ demoRole: "admin" }),
    }));
    expect(unavailable.status).toBe(503);

    process.env.KASIHUB_DEMO_ADMIN_EMAIL = "admin@example.test";
    process.env.KASIHUB_DEMO_ADMIN_PASSWORD = "password";
    mocks.encoreRequest
      .mockResolvedValueOnce({ token: "token" })
      .mockResolvedValueOnce({ member });
    const forbidden = await login(new NextRequest("https://kasihub.test/api/auth/login", {
      method: "POST", body: JSON.stringify({ demoRole: "admin" }),
    }));
    expect(forbidden.status).toBe(403);
  });

  test("session restore returns server truth and clears rejected cookies", async () => {
    mocks.encoreSessionToken.mockResolvedValue(undefined);
    expect(await (await session()).json()).toEqual({ authenticated: false, member: null });

    mocks.encoreSessionToken.mockResolvedValue("token");
    mocks.encoreRequest.mockResolvedValue({ member });
    expect(await (await session()).json()).toEqual({ authenticated: true, member });

    const { EncoreRequestError } = await import("@/lib/encore-client");
    mocks.encoreRequest.mockRejectedValue(new EncoreRequestError("expired", 401, null));
    const expired = await session();
    expect(expired.status).toBe(200);
    expect(expired.headers.get("set-cookie")).toContain("kasihub_session=");
  });

  test("logout revokes upstream when possible and always clears the cookie", async () => {
    mocks.cookieGet.mockReturnValue({ value: "token" });
    const response = await logout();
    expect(mocks.encoreRequest).toHaveBeenCalledWith("/auth/logout", { method: "POST" }, "token");
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");

    mocks.encoreRequest.mockRejectedValue(new Error("upstream unavailable"));
    expect((await logout()).status).toBe(200);
  });
});
