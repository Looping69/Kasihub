import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const root = process.cwd();
const source = (path: string) => readFileSync(join(root, path), "utf8");

describe("password reset gateway contract", () => {
  test("stores only a hash, expires tokens, and consumes them once", () => {
    const api = source("encore/domains/identity/api.ts");
    const migration = source("encore/migrations/identity/11_password_reset_tokens.up.sql");
    expect(api).toContain('createHash("sha256")');
    expect(api).toContain("now() + interval '30 minutes'");
    expect(api).toContain("used_at IS NULL AND expires_at > now()");
    expect(api).toContain("UPDATE sessions SET revoked_at = now()");
    expect(migration).not.toContain("token TEXT");
    expect(migration).toContain("token_hash TEXT NOT NULL UNIQUE");
  });

  test("does not disclose account existence and rate limits recovery mail", () => {
    const api = source("encore/domains/identity/api.ts");
    expect(api).toContain("if (!user) return { accepted: true }");
    expect(api).toContain("requested_at > now() - interval '1 hour'");
    expect(api).toContain('"Idempotency-Key": `password-reset/${resetId}`');
  });

  test("exposes recovery from both login surfaces", () => {
    expect(source("src/components/landing.tsx")).toContain('href="/reset-password"');
    expect(source("src/app/shares/account/shares-account-client.tsx")).toContain('href="/reset-password"');
  });

  test("serializes both Next.js bridge request bodies", () => {
    for (const route of [
      "src/app/api/auth/password-reset/request/route.ts",
      "src/app/api/auth/password-reset/complete/route.ts",
    ]) expect(source(route)).toContain("body: JSON.stringify(body)");
  });
});
