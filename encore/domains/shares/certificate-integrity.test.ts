import { describe, expect, test } from "vitest";
import { certificatePayloadHash, sealPresaleCertificate } from "./certificate-integrity";

const input = {
  verificationId: "57ca0d58-fcdf-4d35-b350-8e040248e63f",
  certificateNumber: "SOL-P1-001",
  holderName: "Test Shareholder",
  holderAddress: "1 Test Street, Johannesburg, 2001, South Africa",
  profileNumber: "KSI-000001",
  orderReference: "KSP-ORDER-001",
  totalShares: 20,
  paidShares: 10,
  bonusShares: 10,
  phaseNumber: 1,
  distinctiveFrom: 1,
  distinctiveTo: 20,
  issuePricePerShare: "25.000000",
  issuedAt: "2026-08-30T12:00:00.000Z",
};

describe("presale certificate integrity seal", () => {
  test("creates a deterministic canonical snapshot", () => {
    const first = sealPresaleCertificate(input);
    const second = sealPresaleCertificate(input);
    expect(first).toEqual(second);
    expect(certificatePayloadHash(first.payload)).toBe(first.sha256);
    expect(first.data).toMatchObject({ shareClass: "CLASS B", issuePriceCurrency: "USD" });
  });

  test("changes the seal when a legally material field changes", () => {
    expect(sealPresaleCertificate({ ...input, holderName: "Another Holder" }).sha256)
      .not.toBe(sealPresaleCertificate(input).sha256);
  });

  test("rejects inconsistent allocations", () => {
    expect(() => sealPresaleCertificate({ ...input, bonusShares: 9 })).toThrow("invalid_certificate_allocation");
  });
});
