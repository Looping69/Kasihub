// Author: Klaasvaakie ( |╲ )
import { describe, expect, test } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "./proxy";

describe("API CSRF boundary", () => {
  test("allows safe requests", async () => {
    const response = await proxy(new NextRequest("https://kasihub.test/api/auth/session"));
    expect(response.status).toBe(200);
  });

  test("allows same-origin mutations", async () => {
    const response = await proxy(new NextRequest("https://kasihub.test/api/auth/login", {
      method: "POST",
      headers: { Origin: "https://kasihub.test", "Sec-Fetch-Site": "same-origin" },
    }));
    expect(response.status).toBe(200);
  });

  test("allows same-origin mutations behind the production reverse proxy", async () => {
    const response = await proxy(new NextRequest("http://kasihub-live:3000/api/auth/login", {
      method: "POST",
      headers: {
        Host: "kasihub-live:3000",
        Origin: "https://forge.smartunitednetwork.com",
        "Sec-Fetch-Site": "same-origin",
        "X-Forwarded-Host": "forge.smartunitednetwork.com",
        "X-Forwarded-Proto": "https",
      },
    }));
    expect(response.status).toBe(200);
  });

  test("rejects cross-site and originless mutations", async () => {
    const crossSite = await proxy(new NextRequest("https://kasihub.test/api/auth/login", {
      method: "POST",
      headers: { Origin: "https://attacker.invalid", "Sec-Fetch-Site": "cross-site" },
    }));
    expect(crossSite.status).toBe(403);
    expect(await crossSite.json()).toMatchObject({ error: "Cross-site request rejected" });

    const originless = await proxy(new NextRequest("https://kasihub.test/api/auth/login", { method: "POST" }));
    expect(originless.status).toBe(403);
  });
});

describe("temporary site lock", () => {
  test("redirects page visitors while allowing the lock page", async () => {
    process.env.SITE_LOCK_PIN = "1538";
    process.env.SITE_LOCK_SECRET = "test-only-secret";
    const blocked = await proxy(new NextRequest("https://kasihub.test/presale?invite=abc"));
    expect(blocked.status).toBe(307);
    expect(blocked.headers.get("location")).toContain("/site-lock?next=%2Fpresale%3Finvite%3Dabc");
    const lockPage = await proxy(new NextRequest("https://kasihub.test/site-lock"));
    expect(lockPage.status).toBe(200);
    delete process.env.SITE_LOCK_PIN;
    delete process.env.SITE_LOCK_SECRET;
  });
});

describe("subdomain routing", () => {
  test("serves the presale experience at the shares hostname root", async () => {
    const response = await proxy(new NextRequest("https://shares.kasihub.net/"));
    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-rewrite")).toBe("https://shares.kasihub.net/presale");
  });

  test("does not rewrite the primary hostname", async () => {
    const response = await proxy(new NextRequest("https://kasihub.net/"));
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
  });
});
