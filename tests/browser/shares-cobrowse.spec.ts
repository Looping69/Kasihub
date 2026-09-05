import { expect, test } from "@playwright/test";

test("support loads on the presale landing page but not unrelated pages", async ({ page }) => {
  let loads = 0;
  await page.route("**/api/**", (route) => route.fulfill({ status: 401, json: {} }));
  await page.route("https://js.cobrowse.io/CobrowseIO.js", (route) => {
    loads++;
    return route.fulfill({ contentType: "application/javascript", body: "window.CobrowseIO = { async start() { this.started = true; }, async stop() {} };" });
  });
  await page.goto("/reset-password");
  await expect(page.locator("body")).not.toBeEmpty();
  expect(loads).toBe(0);
  await page.goto("/presale");
  await expect.poll(() => page.evaluate(() => Reflect.get(window, "CobrowseIO")?.started)).toBe(true);
  expect(loads).toBe(1);
});

for (const width of [390, 1440]) {
  test(`shares support starts once and stops on departure at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/api/**", (route) => route.fulfill({ status: route.request().url().includes("portal") ? 401 : 200, json: {} }));
    await page.route("https://js.cobrowse.io/CobrowseIO.js", (route) => route.fulfill({
      contentType: "application/javascript",
      body: `window.CobrowseIO = {
        starts: 0, stops: 0,
        async start() { this.starts++; },
        async stop() { this.stops++; }
      };`,
    }));
    await page.goto("/shares/account");
    await expect(page.getByRole("heading", { name: "KaSiShares account" })).toBeVisible();
    await expect.poll(() => page.evaluate(() => Reflect.get(window, "CobrowseIO")?.starts)).toBe(1);
    expect(await page.evaluate(() => {
      const sdk = Reflect.get(window, "CobrowseIO");
      return { license: sdk.license, redacted: sdk.redactedViews.includes("input") };
    })).toEqual({ license: "Ioykvhhus", redacted: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole("link", { name: "Forgot password?" }).click();
    await expect(page).toHaveURL(/reset-password/);
    await expect.poll(() => page.evaluate(() => Reflect.get(window, "CobrowseIO")?.stops)).toBe(1);
    expect(await page.evaluate(() => Reflect.get(window, "CobrowseIO").redactedViews)).toEqual(["body"]);
    await page.goBack();
    await expect.poll(() => page.evaluate(() => Reflect.get(window, "CobrowseIO")?.starts)).toBe(2);
    expect(errors).toEqual([]);
  });
}

test("a blocked support SDK does not break the shares account", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/api/**", (route) => route.fulfill({ status: route.request().url().includes("portal") ? 401 : 200, json: {} }));
  await page.route("https://js.cobrowse.io/CobrowseIO.js", (route) => route.abort());
  await page.goto("/shares/account");
  await expect(page.getByRole("heading", { name: "KaSiShares account" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Forgot password?" })).toBeEnabled();
  expect(errors).toEqual([]);
});
