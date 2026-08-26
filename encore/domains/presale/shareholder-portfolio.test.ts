// Author: Klaasvaakie ( |╲ )
import { describe, expect, test } from "vitest";
import { buildShareholderPortfolio } from "./shareholder-portfolio";

describe("presale shareholder portfolio", () => {
  test("distinguishes payment confirmation from legal issuance", () => {
    const portfolio = buildShareholderPortfolio([{
      order_reference: "KSP-PENDING", campaign_name: "Founders", quantity: 3,
      bonus_buy_one_get_one: true, status: "confirmed", incorporation_status: "pending",
    }], []);
    expect(portfolio).toEqual({ totalIssuedShares: 0, holdings: [expect.objectContaining({
      paidShares: 3, bonusShares: 3, allocatedShares: 6, status: "awaiting_issuance",
    })] });
  });

  test("counts only active certificates and exposes reconciliation failures", () => {
    const orders = [
      { order_reference: "KSP-ISSUED", campaign_name: "Campaign A", quantity: 2, bonus_buy_one_get_one: false, status: "incorporated", incorporation_status: "incorporated" },
      { order_reference: "KSP-MISSING", campaign_name: "Campaign B", quantity: 1, bonus_buy_one_get_one: false, status: "incorporated", incorporation_status: "incorporated" },
      { order_reference: "KSP-REVOKED", campaign_name: "Campaign C", quantity: 4, bonus_buy_one_get_one: false, status: "incorporated", incorporation_status: "incorporated" },
    ];
    const certificates = [
      { certificate_number: "CERT-1", total_shares: 2, status: "issued", issued_at: "2026-08-26T00:00:00Z", revoked_at: null, presale_order_reference: "KSP-ISSUED" },
      { certificate_number: "CERT-2", total_shares: 4, status: "revoked", issued_at: "2026-08-26T00:00:00Z", revoked_at: "2026-08-27T00:00:00Z", presale_order_reference: "KSP-REVOKED" },
    ];
    const portfolio = buildShareholderPortfolio(orders, certificates);
    expect(portfolio.totalIssuedShares).toBe(2);
    expect(portfolio.holdings.map((holding) => holding.status)).toEqual(["issued", "issuance_error", "revoked"]);
  });
});
