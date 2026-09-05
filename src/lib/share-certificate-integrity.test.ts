import { createHash } from "node:crypto";
import { describe, expect, test } from "vitest";
import { sealedCertificatePdfData } from "./share-certificate-integrity";

const payload = JSON.stringify({
  version: "solidus-presale-v1", verificationId: "57ca0d58-fcdf-4d35-b350-8e040248e63f",
  certificateNumber: "SOL-P1-001", holderName: "Original Holder", holderAddress: "Original Address",
  profileNumber: "KSI-1", orderReference: "KSP-1", shareClass: "CLASS B", totalShares: 20,
  paidShares: 10, bonusShares: 10, phaseNumber: 1, distinctiveFrom: 1, distinctiveTo: 20,
  issuePricePerShare: "25.000000", issuePriceCurrency: "USD", issuedAt: "2026-08-30T12:00:00.000Z",
});
const certificate = {
  verificationId: "57ca0d58-fcdf-4d35-b350-8e040248e63f", certificateNumber: "SOL-P1-001",
  holderNameSnapshot: "Original Holder", holderAddressSnapshot: "Original Address", profileNumberSnapshot: "KSI-1",
  totalShares: 20, status: "issued", issuedAt: "2026-08-30T12:00:00.000Z", distinctiveFrom: 1, distinctiveTo: 20,
  paidShares: 10, bonusShares: 10, integrityPayload: payload,
  integrityHash: createHash("sha256").update(payload).digest("hex"),
};

describe("certificate PDF snapshot boundary", () => {
  test("preserves the sealed complimentary allocation and rejects ledger mismatch", () => {
    const grantPayload = JSON.stringify({ ...JSON.parse(payload), paidShares: 0, bonusShares: 0, complimentaryShares: 20, couponReference: "coupon", issuePricePerShare: "0" });
    const grant = { ...certificate, paidShares: 0, bonusShares: 0, complimentaryShares: 20, integrityPayload: grantPayload, integrityHash: createHash("sha256").update(grantPayload).digest("hex") };
    expect(sealedCertificatePdfData(grant)).toMatchObject({ paidShares: 0, bonusShares: 0, complimentaryShares: 20, issuePricePerShare: 0 });
    expect(() => sealedCertificatePdfData({ ...grant, complimentaryShares: 19 })).toThrow("certificate_ledger_snapshot_mismatch");
  });
  test("uses the immutable sealed holder details", () => {
    expect(sealedCertificatePdfData(certificate)).toMatchObject({
      holderName: "Original Holder", holderAddress: "Original Address", profileNumber: "KSI-1",
      verificationId: certificate.verificationId,
    });
  });

  test("rejects a modified payload", () => {
    expect(() => sealedCertificatePdfData({ ...certificate, integrityPayload: `${payload} ` }))
      .toThrow("certificate_integrity_mismatch");
  });
});
