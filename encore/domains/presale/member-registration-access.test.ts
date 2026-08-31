// Author: Klaasvaakie ( |╲ )
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const apiPath = fileURLToPath(new URL("./api.ts", import.meta.url));

describe("existing member shareholder registration", () => {
  test("authenticates before granting the isolated presale role and does not require a duplicate account", () => {
    const source = readFileSync(apiPath, "utf8").replace(/\r\n/g, "\n");
    const start = source.indexOf("export const registerPresaleMember");
    const end = source.indexOf("export const loginPresaleApplicant", start);
    const registration = source.slice(start, end);

    const passwordCheck = registration.indexOf("verifyPassword(payload.password, existing.password_hash)");
    const roleGrant = registration.indexOf("WHERE name = 'presale_investor'");

    expect(passwordCheck).toBeGreaterThan(-1);
    expect(roleGrant).toBeGreaterThan(passwordCheck);
    expect(registration).not.toContain("Use a different email address for the separate KaSiShares applicant account");
    expect(registration).toContain("ON CONFLICT (user_id, role_id) DO NOTHING");
  });

  test("targets the partial account-email delivery index created by migration 12", () => {
    const source = readFileSync(apiPath, "utf8").replace(/\r\n/g, "\n");
    const start = source.indexOf("export const registerPresaleMember");
    const end = source.indexOf("export const loginPresaleApplicant", start);
    const registration = source.slice(start, end);

    expect(registration).toContain(`ON CONFLICT (external_profile_id, email_type)
         WHERE application_id IS NOT NULL AND order_id IS NULL`);
  });

  test("keeps SWIFT/BIC optional while validating a supplied code", () => {
    const source = readFileSync(apiPath, "utf8").replace(/\r\n/g, "\n");
    expect(source).toContain("bankSwift: z.string().trim().min(8).max(20).optional()");
  });

  test("does not mint invitations outside the campaign's active window", () => {
    const source = readFileSync(apiPath, "utf8").replace(/\r\n/g, "\n");
    const start = source.indexOf("export const createPresaleInvitation");
    const end = source.indexOf("export const listPresaleOrders", start);
    const invitation = source.slice(start, end);

    expect(invitation).toContain("status = 'active'");
    expect(invitation).toContain("starts_at IS NULL OR starts_at <= now()");
    expect(invitation).toContain("ends_at IS NULL OR ends_at > now()");
    expect(invitation).toContain("APIError.failedPrecondition");
  });
});
