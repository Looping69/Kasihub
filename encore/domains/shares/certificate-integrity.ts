import { createHash } from "node:crypto";

export const PRESALE_CERTIFICATE_SNAPSHOT_VERSION = "solidus-presale-v1";

export type PresaleCertificatePayload = {
  version: typeof PRESALE_CERTIFICATE_SNAPSHOT_VERSION;
  verificationId: string;
  certificateNumber: string;
  holderName: string;
  holderAddress: string;
  profileNumber: string;
  orderReference: string;
  shareClass: "CLASS B";
  totalShares: number;
  paidShares: number;
  bonusShares: number;
  phaseNumber: number;
  distinctiveFrom: number;
  distinctiveTo: number;
  issuePricePerShare: string;
  issuePriceCurrency: "USD";
  issuedAt: string;
};

export function certificatePayloadHash(payload: string): string {
  return createHash("sha256").update(payload, "utf8").digest("hex");
}
export function sealPresaleCertificate(input: Omit<PresaleCertificatePayload, "version" | "shareClass" | "issuePriceCurrency">) {
  const required = [input.verificationId, input.certificateNumber, input.holderName, input.holderAddress,
    input.profileNumber, input.orderReference, input.issuePricePerShare, input.issuedAt];
  if (required.some((value) => !value.trim())) throw new Error("incomplete_certificate_snapshot");
  if (!Number.isInteger(input.totalShares) || input.totalShares <= 0
    || !Number.isInteger(input.paidShares) || input.paidShares <= 0
    || !Number.isInteger(input.bonusShares) || input.bonusShares < 0
    || input.paidShares + input.bonusShares !== input.totalShares) {
    throw new Error("invalid_certificate_allocation");
  }
  if (!Number.isInteger(input.distinctiveFrom) || !Number.isInteger(input.distinctiveTo)
    || input.distinctiveFrom <= 0 || input.distinctiveTo - input.distinctiveFrom + 1 !== input.totalShares) {
    throw new Error("invalid_certificate_distinctive_range");
  }
  if (!Number.isInteger(input.phaseNumber) || input.phaseNumber <= 0 || !Number.isFinite(Number(input.issuePricePerShare))) {
    throw new Error("invalid_certificate_issue_terms");
  }
  if (Number.isNaN(new Date(input.issuedAt).getTime())) throw new Error("invalid_certificate_issue_date");

  const data: PresaleCertificatePayload = {
    version: PRESALE_CERTIFICATE_SNAPSHOT_VERSION,
    verificationId: input.verificationId,
    certificateNumber: input.certificateNumber,
    holderName: input.holderName.trim(),
    holderAddress: input.holderAddress.trim(),
    profileNumber: input.profileNumber.trim(),
    orderReference: input.orderReference,
    shareClass: "CLASS B",
    totalShares: input.totalShares,
    paidShares: input.paidShares,
    bonusShares: input.bonusShares,
    phaseNumber: input.phaseNumber,
    distinctiveFrom: input.distinctiveFrom,
    distinctiveTo: input.distinctiveTo,
    issuePricePerShare: input.issuePricePerShare,
    issuePriceCurrency: "USD",
    issuedAt: input.issuedAt,
  };
  const payload = JSON.stringify(data);
  return { data, payload, sha256: certificatePayloadHash(payload) };
}
