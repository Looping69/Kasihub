// Author: Klaasvaakie ( |╲ )
import { issuedSharesForPresale } from "./settlement";

export type PresalePaidOrder = {
  order_reference: string; campaign_name: string; quantity: number; bonus_buy_one_get_one: boolean;
  status: string; incorporation_status: string;
  total_usd?: string;
};

export type PresaleCertificate = {
  certificate_number: string; total_shares: number; status: string; issued_at: string;
  revoked_at: string | null; presale_order_reference: string;
  phase_number: number | null; distinctive_from: number | null; distinctive_to: number | null;
  paid_shares: number | null; bonus_shares: number | null;
};

export function buildShareholderPortfolio(paidOrders: PresalePaidOrder[], certificates: PresaleCertificate[]) {
  const certificatesByOrder = new Map(certificates.map((certificate) => [certificate.presale_order_reference, certificate]));
  const holdings = paidOrders.map((paidOrder) => {
    const certificate = certificatesByOrder.get(paidOrder.order_reference);
    const allocatedShares = issuedSharesForPresale(paidOrder.quantity, paidOrder.bonus_buy_one_get_one);
    const status = certificate
      ? certificate.status === "revoked" ? "revoked" as const : "issued" as const
      : paidOrder.incorporation_status === "incorporated" ? "issuance_error" as const : "awaiting_issuance" as const;
    return {
      orderReference: paidOrder.order_reference,
      campaignName: paidOrder.campaign_name,
      paidShares: paidOrder.quantity,
      bonusShares: allocatedShares - paidOrder.quantity,
      allocatedShares,
      issuePricePerShare: paidOrder.total_usd === undefined ? undefined : Number(paidOrder.total_usd) / paidOrder.quantity,
      issuePriceCurrency: paidOrder.total_usd === undefined ? undefined : "USD",
      status,
      incorporationStatus: paidOrder.incorporation_status,
      certificate: certificate ? {
        certificateNumber: certificate.certificate_number,
        totalShares: certificate.total_shares,
        status: certificate.status,
        issuedAt: certificate.issued_at,
        revokedAt: certificate.revoked_at ?? undefined,
        phaseNumber: certificate.phase_number ?? undefined,
        distinctiveFrom: certificate.distinctive_from ?? undefined,
        distinctiveTo: certificate.distinctive_to ?? undefined,
        paidShares: certificate.paid_shares ?? undefined,
        bonusShares: certificate.bonus_shares ?? undefined,
      } : undefined,
    };
  });
  return {
    totalIssuedShares: holdings.reduce((total, holding) => total + (holding.status === "issued" ? holding.certificate?.totalShares ?? 0 : 0), 0),
    holdings,
  };
}
