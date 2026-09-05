// Author: Klaasvaakie ( |╲ )
import { describe, expect, test } from "vitest";
import { buildPresaleReservationContract, deriveReservationCancellationPolicy } from "./reservation-contract";

describe("authoritative reservation contract", () => {
  test("shows the exact complimentary quantity without campaign bonus stacking", () => {
    const result = buildPresaleReservationContract({ orderReference: "grant",phaseNumber: 1,campaignName: "test",issuerName: "test",shareClass: "B",
      paidShares: 5,bonusBuyOneGetOne: true,paymentMethod: "complimentary_coupon",unitPriceUsd: "0",totalUsd: "0",unitPriceUsdt: "0",totalUsdt: "0",
      paymentDeadline: "2030-01-01",termsVersion: "v1",status: "confirmed",incorporationStatus: "pending",cancellation: { eligible: false,reason: "reservation_not_awaiting_payment" } });
    expect(result).toMatchObject({ paidShares: 0,bonusShares: 0,complimentaryShares: 5,totalAllocatedShares: 5 });
  });
  test("keeps paid, bonus and total allocation visible with decimal strings", () => {
    const cancellation = deriveReservationCancellationPolicy({ status: "awaiting_payment" });
    expect(buildPresaleReservationContract({
      orderReference: "KSP-ONE", phaseNumber: 1, campaignName: "Founders", issuerName: "Solidus Aureus",
      shareClass: "Class B", paidShares: 3, bonusBuyOneGetOne: true, paymentMethod: "remitano_usdt",
      unitPriceUsd: "25.000000", totalUsd: "75.000000", unitPriceUsdt: "24.937500", totalUsdt: "74.812500",
      network: "bsc", tokenContract: "0x1111111111111111111111111111111111111111",
      receivingAddress: "0x2222222222222222222222222222222222222222", requiredConfirmations: 6,
      paymentDeadline: "2026-08-30T12:00:00Z", termsVersion: "2026-08-16-v1", status: "awaiting_payment",
      incorporationStatus: "pending", cancellation,
    })).toMatchObject({
      phaseLabel: "Phase 1", paidShares: 3, bonusShares: 3, totalAllocatedShares: 6,
      unitPriceUsd: "25.000000", totalUsd: "75.000000", cancellation: { eligible: true },
    });
  });

  test.each([
    [{ status: "confirmed" }, "reservation_not_awaiting_payment"],
    [{ status: "awaiting_payment", transactionHash: "a".repeat(64) }, "crypto_hash_submitted"],
    [{ status: "awaiting_payment", webPayTransactionId: crypto.randomUUID() }, "card_checkout_started"],
  ] as const)("fails cancellation closed when irreversible activity may exist: %s", (input, reason) => {
    expect(deriveReservationCancellationPolicy(input)).toEqual({ eligible: false, reason });
  });
});
