import { describe, expect, test } from "vitest";
import { buildSharesData, mapSharePhase, type EncoreSharePhase } from "./shares-portfolio";

const phases: EncoreSharePhase[] = [
  {
    id: "phase-1", phaseNumber: 1, quantityAvailable: 80, totalShares: 100,
    pricePerShare: "25.00", currency: "USD", status: "closed", bonusBuyOneGet: true,
    createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "phase-2", phaseNumber: 2, quantityAvailable: 95, totalShares: 100,
    pricePerShare: "40.00", currency: "USD", status: "active", bonusBuyOneGet: false,
    createdAt: "2026-02-01T00:00:00.000Z", updatedAt: "2026-02-01T00:00:00.000Z",
  },
];

describe("authoritative member share portfolio mapping", () => {
  test("derives sold inventory from total and available phase quantities", () => {
    expect(mapSharePhase(phases[0])).toMatchObject({ phase: 1, totalShares: 100, soldShares: 20, bonusBuyOneGet: true });
    expect(mapSharePhase(phases[1])).toMatchObject({ phase: 2, totalShares: 100, soldShares: 5, status: "OPEN" });
  });

  test("degrades safely while an older backend response is still in flight", () => {
    expect(mapSharePhase({
      id: "phase-legacy", phaseNumber: 3, quantityAvailable: 75,
      pricePerShare: "50.00", currency: "USD", status: "upcoming",
    })).toMatchObject({ totalShares: 75, soldShares: 0, bonusBuyOneGet: false });
  });

  test("uses the highest open phase when configuration temporarily exposes more than one", () => {
    const result = buildSharesData([
      { ...phases[0], status: "active" },
      phases[1],
    ], []);
    expect(result.shareValuePerShare).toBe(40);
  });

  test("preserves each certificate phase, paid/bonus allocation and authoritative purchase total", () => {
    const result = buildSharesData(phases, [
      {
        certificateNumber: "SOL-P1-001", totalShares: 2, paidShares: 1, bonusShares: 1,
        phaseNumber: 1, purchaseTotalAmount: 25, issuePricePerShare: 25, issuePriceCurrency: "USD",
        status: "issued", issuedAt: "2026-01-02T00:00:00.000Z", revokedAt: null,
      },
      {
        certificateNumber: "SOL-P2-001", totalShares: 3, paidShares: 3, bonusShares: 0,
        phaseNumber: 2, purchaseTotalAmount: 120, issuePricePerShare: 40, issuePriceCurrency: "USD",
        status: "issued", issuedAt: "2026-02-02T00:00:00.000Z", revokedAt: null,
      },
      {
        certificateNumber: "SOL-P1-OLD", totalShares: 2, paidShares: 1, bonusShares: 1,
        phaseNumber: 1, purchaseTotalAmount: 25, issuePricePerShare: 25,
        status: "revoked", issuedAt: "2025-12-01T00:00:00.000Z", revokedAt: "2026-01-02T00:00:00.000Z",
      },
    ]);

    expect(result.activeShares).toHaveLength(2);
    expect(result.retractedShares).toHaveLength(1);
    expect(result.activeShares[0]).toMatchObject({ phase: 1, quantity: 2, paidShares: 1, bonusShares: 1, totalAmount: 25 });
    expect(result.activeShares[1]).toMatchObject({ phase: 2, quantity: 3, paidShares: 3, bonusShares: 0, totalAmount: 120 });
    expect(result.totalShares).toBe(5);
    expect(result.shareValuePerShare).toBe(40);
    expect(result.totalValue).toBe(200);
    expect(result.legacyShares).toBe(1);
    expect(result.totalSharesOutstanding).toBe(25);
    expect(result.profitShareAvailable).toBe(false);
  });

  test("does not invent a phase for an unlinked legacy certificate", () => {
    const result = buildSharesData(phases, [{
      certificateNumber: "CERT-LEGACY", totalShares: 4, status: "issued",
      issuedAt: "2025-01-01T00:00:00.000Z", revokedAt: null,
    }]);
    expect(result.activeShares[0].phase).toBe(0);
    expect(result.activeShares[0].totalAmount).toBe(0);
  });
});
