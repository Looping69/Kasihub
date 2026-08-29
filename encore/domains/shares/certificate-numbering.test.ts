import { describe, expect, test } from "vitest";
import { assertDistinctiveRange, solidusCertificateNumber } from "./certificate-numbering";

describe("Solidus certificate numbering", () => {
  test("formats a phase-scoped sequence", () => {
    expect(solidusCertificateNumber(1, 1)).toBe("SOL-P1-001");
    expect(solidusCertificateNumber(2, 12)).toBe("SOL-P2-012");
  });

  test("allocates inclusive distinctive numbers for paid and bonus shares", () => {
    expect(assertDistinctiveRange(1, 20)).toEqual({ start: 1, end: 20 });
    expect(assertDistinctiveRange(21, 10)).toEqual({ start: 21, end: 30 });
  });

  test("refuses to allocate beyond the authorised register", () => {
    expect(() => assertDistinctiveRange(1_199_991, 11)).toThrow("solidus_share_register_exhausted");
  });
});
