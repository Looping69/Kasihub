export const MAX_SOLIDUS_SHARE_NUMBER = 1_200_000;

export function solidusCertificateNumber(phaseNumber: number, sequence: number): string {
  if (!Number.isInteger(phaseNumber) || phaseNumber <= 0) throw new Error("invalid_share_phase");
  if (!Number.isInteger(sequence) || sequence <= 0) throw new Error("invalid_certificate_sequence");
  return `SOL-P${phaseNumber}-${String(sequence).padStart(3, "0")}`;
}

export function assertDistinctiveRange(start: number, issuedShares: number) {
  if (!Number.isInteger(start) || start <= 0 || !Number.isInteger(issuedShares) || issuedShares <= 0) {
    throw new Error("invalid_share_lot");
  }
  const end = start + issuedShares - 1;
  if (end > MAX_SOLIDUS_SHARE_NUMBER) throw new Error("solidus_share_register_exhausted");
  return { start, end };
}
