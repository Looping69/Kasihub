// Author: Klaasvaakie ( |╲ )
import { describe, expect, test } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("password contracts", () => {
  test("uses salted scrypt hashes and verifies only the original password", () => {
    const first = hashPassword("correct horse battery staple");
    const second = hashPassword("correct horse battery staple");
    expect(first).toMatch(/^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/);
    expect(second).not.toBe(first);
    expect(verifyPassword("correct horse battery staple", first)).toBe(true);
    expect(verifyPassword("wrong password", first)).toBe(false);
  });

  test("rejects malformed and unsupported stored values", () => {
    expect(verifyPassword("password", "argon2:salt:hash")).toBe(false);
    expect(verifyPassword("password", "scrypt::hash")).toBe(false);
    expect(verifyPassword("password", "")).toBe(false);
  });
});
