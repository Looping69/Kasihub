// Author: Klaasvaakie ( |╲ )
import { describe, expect, test } from "vitest";
import { internationalCellphoneSchema, normalizeInternationalCellphone, physicalAddressLine, strongPasswordSchema } from "./applicant-validation";

describe("KaSiShares applicant validation", () => {
  test("normalizes and validates cellphone length against the international country code", () => {
    expect(internationalCellphoneSchema.parse("+27 82 123 4567")).toBe("+27821234567");
    expect(normalizeInternationalCellphone("+44 7911 123456")).toBe("+447911123456");
    expect(internationalCellphoneSchema.safeParse("+27 82").success).toBe(false);
    expect(internationalCellphoneSchema.safeParse("0821234567").success).toBe(false);
  });

  test("requires a long password containing a number and a special character", () => {
    expect(strongPasswordSchema.safeParse("Secure-pass-2026").success).toBe(true);
    expect(strongPasswordSchema.safeParse("short-2!").success).toBe(false);
    expect(strongPasswordSchema.safeParse("LongPasswordOnly").success).toBe(false);
    expect(strongPasswordSchema.safeParse("LongPassword123").success).toBe(false);
  });

  test("creates one stable legacy address line from the required structured fields", () => {
    expect(physicalAddressLine({ streetAddress: "1 Main Road", suburb: "Sunnyside", city: "Pretoria", postalCode: "0002" }))
      .toBe("1 Main Road, Sunnyside, Pretoria, 0002");
  });
});
