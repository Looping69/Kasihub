// Author: Klaasvaakie ( |╲ )
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const cookieGet = vi.hoisted(() => vi.fn());
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({ get: cookieGet })) }));

import { EncoreRequestError, encoreRequest, encoreSessionToken } from "./encore-client";

beforeEach(() => {
  vi.restoreAllMocks();
  process.env.ENCORE_API_URL = "https://encore.example.test/";
  cookieGet.mockReset();
});

afterEach(() => { delete process.env.ENCORE_API_URL; });

describe("Encore server client", () => {
  test("fails closed when the backend is not configured", async () => {
    delete process.env.ENCORE_API_URL;
    await expect(encoreRequest("/health")).rejects.toMatchObject({ status: 503 });
  });

  test("sends JSON, bearer authentication, and disables caching", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { "content-type": "application/json" },
    }));
    await expect(encoreRequest("/mutation", { method: "POST", body: JSON.stringify({ value: 1 }) }, "token"))
      .resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith("https://encore.example.test/mutation", expect.objectContaining({ cache: "no-store" }));
    const init = fetchMock.mock.calls[0][1]!;
    const headers = init.headers as Headers;
    expect(headers.get("authorization")).toBe("Bearer token");
    expect(headers.get("content-type")).toBe("application/json");
  });

  test("preserves structured upstream errors and non-JSON payloads", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(JSON.stringify({ code: "conflict" }), { status: 409 }));
    await expect(encoreRequest("/conflict")).rejects.toEqual(expect.objectContaining<Partial<EncoreRequestError>>({
      status: 409, details: { code: "conflict" },
    }));

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("plain response", { status: 200 }));
    await expect(encoreRequest("/plain")).resolves.toBe("plain response");
  });

  test("reads only the HTTP-only session cookie", async () => {
    cookieGet.mockReturnValue({ value: "session" });
    await expect(encoreSessionToken()).resolves.toBe("session");
    expect(cookieGet).toHaveBeenCalledWith("kasihub_session");
  });
});
