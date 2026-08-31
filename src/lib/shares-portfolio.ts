import type { AureusShare, Share, SharePhase } from "@/lib/types";

export type EncoreSharePhase = {
  id: string;
  phaseNumber: number;
  quantityAvailable: number;
  totalShares?: number;
  pricePerShare: string;
  currency: string;
  status: string;
  bonusBuyOneGet?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type EncoreShareCertificate = {
  certificateNumber: string;
  totalShares: number;
  status: string;
  issuedAt: string;
  revokedAt: string | null;
  phaseNumber?: number;
  paidShares?: number;
  bonusShares?: number;
  purchaseTotalAmount?: number;
  issuePricePerShare?: number;
  issuePriceCurrency?: string;
  source?: string;
};

export type SharesData = {
  phases: SharePhase[];
  activeShares: Share[];
  retractedShares: Share[];
  aureusShares: AureusShare[];
  retractedAureusShares: AureusShare[];
  totalShares: number;
  totalValue: number;
  shareValuePerShare: number;
  legacyShares: number;
  aureusValuePerShare: number;
  aureusTotalShares: number;
  aureusTotalValue: number;
  profitShareAvailable: boolean;
  dailyProfitSharePerShare: number;
  myDailyProfitShare: number;
  totalSharesOutstanding: number;
};

export function mapSharePhase(phase: EncoreSharePhase): SharePhase {
  // Accept the previous Encore response shape during a rolling deployment.
  // Available inventory is the only safe fallback; it never invents sold shares.
  const totalShares = Math.max(phase.totalShares ?? phase.quantityAvailable, phase.quantityAvailable);
  return {
    id: phase.id,
    phase: phase.phaseNumber,
    pricePerShare: Number(phase.pricePerShare),
    totalShares,
    soldShares: Math.max(0, totalShares - phase.quantityAvailable),
    status: phase.status === "active" ? "OPEN" : phase.status.toUpperCase(),
    bonusBuyOneGet: phase.bonusBuyOneGet ?? false,
  };
}

export function buildSharesData(
  phaseRecords: EncoreSharePhase[],
  certificates: EncoreShareCertificate[],
): SharesData {
  const phases = phaseRecords.map(mapSharePhase);
  const currentPhase = phases
    .filter((phase) => phase.status === "OPEN")
    .toSorted((left, right) => right.phase - left.phase)[0]
    ?? phases.toSorted((left, right) => right.phase - left.phase)[0];
  const currentShareValue = currentPhase?.pricePerShare
    ?? Math.max(0, ...certificates.map((certificate) => certificate.issuePricePerShare ?? 0));

  const mapCertificate = (certificate: EncoreShareCertificate): Share => {
    const paidShares = certificate.paidShares
      ?? Math.max(0, certificate.totalShares - (certificate.bonusShares ?? 0));
    const bonusShares = certificate.bonusShares ?? Math.max(0, certificate.totalShares - paidShares);
    const issuePrice = certificate.issuePricePerShare ?? 0;
    const purchaseTotal = certificate.purchaseTotalAmount ?? issuePrice * paidShares;
    const currentValuePerShare = currentShareValue || issuePrice;
    return {
      id: certificate.certificateNumber,
      phase: certificate.phaseNumber ?? 0,
      pricePerShare: issuePrice,
      quantity: certificate.totalShares,
      paidShares,
      bonusShares,
      totalAmount: purchaseTotal,
      certificateNo: certificate.certificateNumber,
      prevCertificateNo: null,
      status: certificate.status.toUpperCase(),
      createdAt: certificate.issuedAt,
      isLegacy: certificate.phaseNumber === 1 && bonusShares > 0,
      currentValuePerShare,
      currentTotalValue: certificate.totalShares * currentValuePerShare,
    };
  };

  const activeShares = certificates
    .filter((certificate) => certificate.status.toLowerCase() !== "revoked")
    .map(mapCertificate);
  const retractedShares = certificates
    .filter((certificate) => certificate.status.toLowerCase() === "revoked")
    .map(mapCertificate);
  const totalShares = activeShares.reduce((sum, share) => sum + share.quantity, 0);

  return {
    phases,
    activeShares,
    retractedShares,
    aureusShares: [],
    retractedAureusShares: [],
    totalShares,
    totalValue: activeShares.reduce((sum, share) => sum + (share.currentTotalValue ?? 0), 0),
    shareValuePerShare: currentShareValue,
    legacyShares: activeShares.reduce((sum, share) => sum + (share.phase === 1 ? share.bonusShares ?? 0 : 0), 0),
    aureusValuePerShare: 0,
    aureusTotalShares: 0,
    aureusTotalValue: 0,
    profitShareAvailable: false,
    dailyProfitSharePerShare: 0,
    myDailyProfitShare: 0,
    totalSharesOutstanding: phases.reduce((sum, phase) => sum + phase.soldShares, 0),
  };
}
