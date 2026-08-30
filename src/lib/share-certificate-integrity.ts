import { createHash } from "node:crypto";
import type { ShareCertificatePdfData } from "./share-certificate-pdf";

export type CertificateIntegrityFields = {
  verificationId?: string;
  holderNameSnapshot?: string;
  holderAddressSnapshot?: string;
  profileNumberSnapshot?: string;
  integrityPayload?: string;
  integrityHash?: string;
};

type LedgerCertificate = CertificateIntegrityFields & {
  certificateNumber: string;
  totalShares: number;
  status: string;
  issuedAt: string;
  distinctiveFrom?: number;
  distinctiveTo?: number;
  paidShares?: number;
  bonusShares?: number;
  issuePricePerShare?: number;
  issuePriceCurrency?: string;
};

export function sealedCertificatePdfData(certificate: LedgerCertificate): ShareCertificatePdfData | null {
  const fields = [certificate.verificationId, certificate.holderNameSnapshot, certificate.holderAddressSnapshot,
    certificate.profileNumberSnapshot, certificate.integrityPayload, certificate.integrityHash];
  if (fields.every((value) => value === undefined)) return null;
  if (fields.some((value) => !value)) throw new Error("incomplete_certificate_integrity_record");
  const hash = createHash("sha256").update(certificate.integrityPayload!, "utf8").digest("hex");
  if (hash !== certificate.integrityHash) throw new Error("certificate_integrity_mismatch");
  const payload = JSON.parse(certificate.integrityPayload!) as Record<string, unknown>;
  const equals = (name: string, value: unknown) => payload[name] === value;
  const sameIssueInstant = typeof payload.issuedAt === "string"
    && new Date(payload.issuedAt).getTime() === new Date(certificate.issuedAt).getTime();
  if (!equals("version", "solidus-presale-v1")
    || !equals("verificationId", certificate.verificationId)
    || !equals("certificateNumber", certificate.certificateNumber)
    || !equals("totalShares", certificate.totalShares)
    || !sameIssueInstant
    || !equals("distinctiveFrom", certificate.distinctiveFrom)
    || !equals("distinctiveTo", certificate.distinctiveTo)
    || !equals("paidShares", certificate.paidShares)
    || !equals("bonusShares", certificate.bonusShares)) {
    throw new Error("certificate_ledger_snapshot_mismatch");
  }
  if (payload.holderName !== certificate.holderNameSnapshot
    || payload.holderAddress !== certificate.holderAddressSnapshot
    || payload.profileNumber !== certificate.profileNumberSnapshot) {
    throw new Error("certificate_holder_snapshot_mismatch");
  }
  if (certificate.issuePricePerShare !== undefined && Number(payload.issuePricePerShare) !== certificate.issuePricePerShare) {
    throw new Error("certificate_issue_price_snapshot_mismatch");
  }
  return {
    certificateNumber: certificate.certificateNumber,
    holderName: certificate.holderNameSnapshot!,
    holderAddress: certificate.holderAddressSnapshot!,
    profileNumber: certificate.profileNumberSnapshot!,
    orderReference: typeof payload.orderReference === "string" ? payload.orderReference : undefined,
    totalShares: certificate.totalShares,
    issuedAt: certificate.issuedAt,
    status: certificate.status,
    paidShares: certificate.paidShares,
    bonusShares: certificate.bonusShares,
    distinctiveFrom: certificate.distinctiveFrom,
    distinctiveTo: certificate.distinctiveTo,
    issuePricePerShare: typeof payload.issuePricePerShare === "string" ? Number(payload.issuePricePerShare) : certificate.issuePricePerShare,
    issuePriceCurrency: typeof payload.issuePriceCurrency === "string" ? payload.issuePriceCurrency : certificate.issuePriceCurrency,
    verificationId: certificate.verificationId,
    integrityHash: certificate.integrityHash,
  };
}
