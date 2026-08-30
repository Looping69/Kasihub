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
