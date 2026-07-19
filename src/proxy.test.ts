// Author: Klaasvaakie ( |╲ )
import { describe, expect, test } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "./proxy";

describe("API CSRF boundary", () => {
  test("allows safe requests", () => {
    const response = proxy(new NextRequest("https://kasihub.test/api/auth/session"));
    expect(response.status).toBe(200);
  });

  test("allows same-origin mutations", () => {
    const response = proxy(new NextRequest("https://kasihub.test/api/auth/login", {
      method: "POST",
      headers: { Origin: "https://kasihub.test", "Sec-Fetch-Site": "same-origin" },
    }));
    expect(response.status).toBe(200);
  });

  test("rejects cross-site and originless mutations", async () => {
    const crossSite = proxy(new NextRequest("https://kasihub.test/api/auth/login", {
      method: "POST",
      headers: { Origin: "https://attacker.invalid", "Sec-Fetch-Site": "cross-site" },
    }));
    expect(crossSite.status).toBe(403);
    expect(await crossSite.json()).toMatchObject({ error: "Cross-site request rejected" });

    const originless = proxy(new NextRequest("https://kasihub.test/api/auth/login", { method: "POST" }));
    expect(originless.status).toBe(403);
  });
});
