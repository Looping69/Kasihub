// Author: Klaasvaakie ( |╲ )
import { expect, test } from "@playwright/test";

test("landing page boots from server session truth", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/KaSiHUB/i);
  await expect(page.getByRole("heading", { name: "The hybrid ecosystem for community wealth." })).toBeVisible();
  const session = await page.request.get("/api/auth/session");
  await expect(session).toBeOK();
  expect(await session.json()).toMatchObject({ authenticated: false, member: null });
});

test("cross-site state-changing requests are rejected", async ({ request }) => {
  const response = await request.post("/api/auth/login", {
    headers: { Origin: "https://attacker.invalid", "Sec-Fetch-Site": "cross-site" },
    data: { email: "victim@example.com", password: "not-a-real-password" },
  });
  expect(response.status()).toBe(403);
  expect(await response.json()).toMatchObject({ error: "Cross-site request rejected" });
});
