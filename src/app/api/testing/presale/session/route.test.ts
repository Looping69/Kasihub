import { afterEach, describe, expect, test, vi } from "vitest";
import { POST } from "./route";

afterEach(() => vi.unstubAllEnvs());

describe("presale E2E development session bridge", () => {
  test("is invisible outside development", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const response = await POST(new Request("https://example.test", { method: "POST", body: "{}" }));
    expect(response.status).toBe(404);
  });

  test("sets only the presale cookie for a development test run", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const response = await POST(new Request("http://127.0.0.1:3000/api/testing/presale/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionToken: "a".repeat(72) }),
    }));
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("kasishares_session=");
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).not.toContain("Secure");
  });
});
