import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ encoreRequest: vi.fn(), encoreSessionToken: vi.fn(), presaleSessionToken: vi.fn() }));
vi.mock("@/lib/encore-client", () => {
  class EncoreRequestError extends Error {
    constructor(message: string, public status: number, public details: unknown = null) { super(message); }
  }
  return { EncoreRequestError, ...mocks };
});
import { EncoreRequestError } from "@/lib/encore-client";
import { POST as generate } from "./route";
import { POST as policy } from "./policy/route";
import { GET as list } from "./[campaignId]/route";
import { POST as revoke } from "./[campaignId]/revoke/route";
import { POST as preview } from "../../../presale/coupons/preview/route";
const request = () => new NextRequest("https://example.test/api", { method: "POST", body: JSON.stringify({ code: "example", quantity: 2 }) });
beforeEach(() => {
  vi.resetAllMocks();
  mocks.encoreSessionToken.mockResolvedValue("admin-session");
  mocks.presaleSessionToken.mockResolvedValue("presale-session");
});
for (const [name, handler, path, session] of [
  ["generate", generate, "/admin/presale/coupons", "admin-session"],
  ["policy", policy, "/admin/presale/coupons/policy", "admin-session"],
  ["preview", preview, "/presale/coupons/preview", "presale-session"],
] as const) {
  describe(name, () => {
    test("requires the correct session before forwarding", async () => {
      (session === "admin-session" ? mocks.encoreSessionToken : mocks.presaleSessionToken).mockResolvedValue(undefined);
      expect((await handler(request())).status).toBe(401);
      expect(mocks.encoreRequest).not.toHaveBeenCalled();
    });
    test("forwards the request with server session and prevents caching", async () => {
      mocks.encoreRequest.mockResolvedValue({ valid: true });
      const response = await handler(request());
      expect(await response.json()).toEqual({ valid: true });
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(mocks.encoreRequest).toHaveBeenCalledWith(path, { method: "POST", body: JSON.stringify({ code: "example", quantity: 2 }) }, session);
    });
    test.each([
      [new EncoreRequestError("failure", 400, { message: "Coupon expired" }), 400, "Coupon expired"],
      [new EncoreRequestError("failure", 403, {}), 403, "Unable to process coupon request"],
      [new EncoreRequestError("failure", 500, { message: "database secret" }), 500, "Unable to process coupon request"],
      [new Error("internal secret"), 500, "Unable to process coupon request"],
    ])("maps backend failures without exposing internals", async (error, status, message) => {
      mocks.encoreRequest.mockRejectedValue(error);
      const response = await handler(request());
      expect(response.status).toBe(status);
      expect(await response.json()).toEqual({ error: message });
    });
  });
}
for (const [name, handler, method, suffix] of [["list", list, "GET", ""], ["revoke", revoke, "POST", "/revoke"]] as const) {
  describe(name, () => {
    const context = { params: Promise.resolve({ campaignId: "a/b" }) };
    test("rejects a presale-only session", async () => {
      mocks.encoreSessionToken.mockResolvedValue(undefined);
      expect((await handler(request(), context)).status).toBe(401);
      expect(mocks.encoreRequest).not.toHaveBeenCalled();
    });
    test("encodes the identifier and forwards admin credentials", async () => {
      mocks.encoreRequest.mockResolvedValue({ ok: true });
      const response = await handler(request(), context);
      expect(await response.json()).toEqual({ ok: true });
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(mocks.encoreRequest).toHaveBeenCalledWith(`/admin/presale/coupons/a%2Fb${suffix}`, { method }, "admin-session");
    });
    test.each([[new EncoreRequestError("secret", 403, null), 403], [new Error("secret"), 500]])("hides error details", async (error, status) => {
      mocks.encoreRequest.mockRejectedValue(error);
      const response = await handler(request(), context);
      expect(response.status).toBe(status);
      expect(await response.json()).toEqual({ error: "Unable to process coupon request" });
    });
  });
}

