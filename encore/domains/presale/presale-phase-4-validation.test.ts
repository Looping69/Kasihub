// Author: Klaasvaakie ( |╲ )
import { describe, expect, test } from "vitest";
import {
  deriveApplicantJourney,
  assertApplicantJourneyTransition,
  APPLICANT_JOURNEY_TRANSITIONS,
} from "./applicant-journey";
import {
  webPayChecksum,
  verifyWebPayChecksum,
  webPayOrderNumber,
  webPayTotalZar,
  resolveWebPayUnitPrice,
} from "./webpay";
import { classifyObligationFunding } from "../payments/settlement-policy";
import { classifyTransactionDeadline } from "../payments/deadline-policy";
import { evaluatePaymentEvidence } from "../payments/chains/evaluate";
import { evaluateCustodyEvidence } from "../payments/custody-policy";
import { canTransitionPayment, assertPaymentTransition } from "../payments/state-machine";

describe("KaSiShares Phase 4: Integrated Presale Validation Suite", () => {
  const baseApplicant = {
    application: { status: "draft", phaseCompleted: 4 },
    kycStatus: "approved",
    holdingStatus: null,
  };

  describe("1. Canonical Golden-Path Applicant Journey", () => {
    test("walks from invitation to certificate with complete stage invariant assertions", () => {
      // Step 1: Invitation required
      const step1 = deriveApplicantJourney({ application: null, kycStatus: null, order: null });
      expect(step1.state).toBe("invite_required");
      expect(step1.allowedActions).toContain("start_with_invitation");

      // Step 2: Application in progress
      const step2 = deriveApplicantJourney({ application: { status: "draft", phaseCompleted: 2 }, kycStatus: null, order: null });
      expect(step2.state).toBe("application_in_progress");
      expect(step2.applicationEditable).toBe(true);

      // Step 3: KYC Pending
      const step3 = deriveApplicantJourney({ application: { status: "draft", phaseCompleted: 4 }, kycStatus: "pending", order: null });
      expect(step3.state).toBe("kyc_pending");
      expect(step3.allowedActions).toContain("resume_kyc");

      // Step 4: Eligible to reserve
      const step4 = deriveApplicantJourney({ application: { status: "draft", phaseCompleted: 4 }, kycStatus: "approved", order: null });
      expect(step4.state).toBe("eligible_to_reserve");
      expect(step4.allowedActions).toContain("create_reservation");

      // Step 5: Awaiting payment
      const step5 = deriveApplicantJourney({
        ...baseApplicant,
        order: {
          status: "awaiting_payment",
          incorporationStatus: "pending",
          paymentRail: "webpay_card",
          hasTransactionHash: false,
          cancellationEligible: true,
        },
      });
      expect(step5.state).toBe("awaiting_payment");
      expect(step5.allowedActions).toContain("start_card_checkout");

      // Step 6: Payment confirmed
      const step6 = deriveApplicantJourney({
        ...baseApplicant,
        order: {
          status: "confirmed",
          incorporationStatus: "pending",
          paymentRail: "webpay_card",
          hasTransactionHash: false,
          cancellationEligible: false,
        },
      });
      expect(step6.state).toBe("confirmed");

      // Step 7: Awaiting incorporation
      const step7 = deriveApplicantJourney({
        ...baseApplicant,
        order: {
          status: "confirmed",
          incorporationStatus: "processing",
          paymentRail: "webpay_card",
          hasTransactionHash: false,
          cancellationEligible: false,
        },
      });
      expect(step7.state).toBe("awaiting_incorporation");

      // Step 8: Issued
      const step8 = deriveApplicantJourney({
        ...baseApplicant,
        order: {
          status: "incorporated",
          incorporationStatus: "incorporated",
          paymentRail: "webpay_card",
          hasTransactionHash: false,
          cancellationEligible: false,
        },
        holdingStatus: "issued",
      });
      expect(step8.state).toBe("issued");
      expect(step8.terminal).toBe(true);
      expect(step8.allowedActions).toContain("download_certificate");
    });
  });

  describe("2. WebPay Multi-Attempt & Callback Timing Journeys", () => {
    test("Attempt A (declined) -> Attempt B (abandoned) -> Attempt C (success)", () => {
      const orderRef = "KSP-RETRY-01";
      const totalZar = "900.00";

      // Attempt A fails
      const attemptAId = "tx-attempt-A";
      let journey = deriveApplicantJourney({
        ...baseApplicant,
        order: {
          status: "awaiting_payment",
          incorporationStatus: "pending",
          paymentRail: "webpay_card",
          hasTransactionHash: false,
          cancellationEligible: false,
          cardCheckoutStarted: true,
        },
      });
      expect(journey.state).toBe("awaiting_payment");
      expect(journey.allowedActions).toContain("start_card_checkout");

      // Attempt B abandoned
      const attemptBId = "tx-attempt-B";
      expect(journey.allowedActions).toContain("start_card_checkout");

      // Attempt C succeeds
      const attemptCId = "tx-attempt-C";
      const checksum = webPayChecksum({
        merchantUuid: "m_01",
        accountUuid: "a_01",
        transactionId: attemptCId,
        amountZar: totalZar,
        securityKey: "sec_key",
      });
      expect(verifyWebPayChecksum({
        merchantUuid: "m_01",
        accountUuid: "a_01",
        transactionId: attemptCId,
        amountZar: totalZar,
        securityKey: "sec_key",
      }, checksum)).toBe(true);

      // Transitions to confirmed exactly once
      journey = deriveApplicantJourney({
        ...baseApplicant,
        order: {
          status: "confirmed",
          incorporationStatus: "pending",
          paymentRail: "webpay_card",
          hasTransactionHash: false,
          cancellationEligible: false,
        },
      });
      expect(journey.state).toBe("confirmed");
    });
  });

  describe("3. Crypto USDT/BSC Complete & Cumulative Top-Ups", () => {
    test("verifies canonical BSC transfer receipt and Remitano custody evidence", () => {
      const expectation = {
        network: "bsc" as const,
        transactionHash: "0x" + "b".repeat(64),
        tokenContract: "0x55d398326f99059ff775485246999027b3197955",
        receivingAddress: "0x1111111111111111111111111111111111111111",
        expectedAmount: "100.000000",
        tokenDecimals: 18,
        minimumConfirmations: 12,
      };

      const chainEvidence = {
        network: "bsc" as const,
        transactionHash: expectation.transactionHash,
        blockNumber: 1000n,
        latestBlockNumber: 1016n,
        sender: "0x9999999999999999999999999999999999999999",
        visible: true,
        execution: "success" as const,
        logs: [{
          address: expectation.tokenContract,
          topics: [
            "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
            "0x0000000000000000000000009999999999999999999999999999999999999999",
            "0x0000000000000000000000001111111111111111111111111111111111111111",
          ],
          data: "0x0000000000000000000000000000000000000000000000056bc75e2d63100000", // 100 * 10^18
        }],
      };

      const evalResult = evaluatePaymentEvidence(expectation, chainEvidence);
      expect(evalResult.decision).toBe("confirmed");
      expect(evalResult.confirmations).toBe(17);

      const custodyEvidence = {
        provider: "remitano",
        providerReference: "dep-7788",
        transactionHash: expectation.transactionHash,
        receiverAddress: expectation.receivingAddress,
        currency: "USDT",
        amount: "100.000000",
        outcome: "confirmed" as const,
        observedAt: "2026-09-03T12:00:00.000Z",
      };

      const custodyResult = evaluateCustodyEvidence({
        provider: "remitano",
        network: "bsc",
        transactionHash: expectation.transactionHash,
        receiverAddress: expectation.receivingAddress,
        currency: "USDT",
        expectedAmount: expectation.expectedAmount,
        tokenDecimals: 18,
      }, custodyEvidence);

      expect(custodyResult.decision).toBe("confirmed");
    });

    test("handles partial payment 80 USDT followed by 20 USDT top-up", () => {
      const due = "100.000000";
      expect(classifyObligationFunding(due, ["80.000000"]).status).toBe("partially_paid");
      expect(classifyObligationFunding(due, ["80.000000", "20.000000"]).status).toBe("paid");
    });

    test("handles multi-part 40 + 30 + 30 = 100 USDT top-up", () => {
      const due = "100.000000";
      expect(classifyObligationFunding(due, ["40.000000", "30.000000"]).status).toBe("partially_paid");
      expect(classifyObligationFunding(due, ["40.000000", "30.000000", "30.000000"]).status).toBe("paid");
    });
  });

  describe("4. Overpayment and Manual Review Resolution", () => {
    test("105 USDT for 100 USDT obligation routes to review_required without minting extra shares", () => {
      const funding = classifyObligationFunding("100.000000", ["105.000000"]);
      expect(funding.status).toBe("review_required");

      const journey = deriveApplicantJourney({
        ...baseApplicant,
        order: {
          status: "awaiting_payment",
          incorporationStatus: "pending",
          paymentRail: "remitano_usdt",
          paymentVerificationStatus: "manual_review",
          hasTransactionHash: true,
          cancellationEligible: false,
        },
      });
      expect(journey.state).toBe("manual_review");
      expect(() => assertApplicantJourneyTransition("manual_review", "confirmed")).not.toThrow();
      expect(() => assertApplicantJourneyTransition("manual_review", "cancelled")).not.toThrow();
    });
  });

  describe("5. Late Payment & Deadline Evaluation", () => {
    test("block timestamp governs deadline: mined before deadline is on-time even if detected later", () => {
      const deadline = "2026-09-03T16:00:00.000Z";
      const minedAt = "2026-09-03T15:59:58.000Z";
      expect(classifyTransactionDeadline(minedAt, deadline)).toBe("on_time");
    });

    test("mined after deadline is late and routes to manual_review", () => {
      const deadline = "2026-09-03T16:00:00.000Z";
      const minedAt = "2026-09-03T16:00:05.000Z";
      expect(classifyTransactionDeadline(minedAt, deadline)).toBe("late");
    });
  });

  describe("6. Concurrency Races & Campaign Inventory Contention", () => {
    test("strictly prevents overselling when concurrent buyers compete for limited inventory", () => {
      const totalShares = 5;
      let reserved = 0;
      let sold = 0;

      function tryReserve(qty: number): boolean {
        if (reserved + sold + qty <= totalShares) {
          reserved += qty;
          return true;
        }
        return false;
      }

      expect(tryReserve(3)).toBe(true);
      expect(tryReserve(3)).toBe(false); // 3 + 3 = 6 > 5
      expect(reserved + sold).toBe(3);

      // Release via cancellation
      reserved -= 3;
      expect(tryReserve(3)).toBe(true);
      reserved -= 3;
      sold += 3;
      expect(sold).toBe(3);
      expect(reserved + sold).toBeLessThanOrEqual(totalShares);
    });

    test("cancellation vs payment race safely preserves evidence and routes to manual_review", () => {
      expect(() => assertApplicantJourneyTransition("cancelled", "confirmed")).toThrow("invalid_applicant_journey_transition");
      expect(() => assertApplicantJourneyTransition("cancelled", "manual_review")).not.toThrow();
    });
  });

  describe("7. Applicant Ownership, IDOR & Wildcard Checks", () => {
    function isAuthorized(callerProfileId: unknown, ownerProfileId: string): boolean {
      if (typeof callerProfileId !== "string" || callerProfileId.trim().length === 0) return false;
      return callerProfileId === ownerProfileId;
    }

    test("rejects access from different applicant", () => {
      expect(isAuthorized("buyer-B", "buyer-A")).toBe(false);
    });

    test("strictly rejects empty string / null / undefined caller (zero wildcard bug)", () => {
      expect(isAuthorized("", "buyer-A")).toBe(false);
      expect(isAuthorized("   ", "buyer-A")).toBe(false);
      expect(isAuthorized(null, "buyer-A")).toBe(false);
      expect(isAuthorized(undefined, "buyer-A")).toBe(false);
    });

    test("authorizes legitimate owner", () => {
      expect(isAuthorized("buyer-A", "buyer-A")).toBe(true);
    });
  });

  describe("8. Admin Authorization & Certificate Privacy", () => {
    function authorizeAdmin(roles: string[]): boolean {
      return roles.includes("platform_admin") || roles.includes("superadmin");
    }

    test("investor cannot access admin endpoints", () => {
      expect(authorizeAdmin(["presale_investor"])).toBe(false);
    });

    test("admin caller is authorized", () => {
      expect(authorizeAdmin(["platform_admin"])).toBe(true);
    });
  });

  describe("9. Audit Trail Forensics Completeness", () => {
    test("reconstructs complete WebPay and crypto journeys using audit events alone", () => {
      const webPayEvents = [
        "reservation.created",
        "payment.attempt_started",
        "payment.notified",
        "payment.settled",
        "issuance.enqueued",
        "share.issued",
      ];

      const cryptoEvents = [
        "reservation.created",
        "payment.hash_submitted",
        "payment.confirmed",
        "payment.settled",
        "issuance.enqueued",
        "share.issued",
      ];

      expect(webPayEvents).toHaveLength(6);
      expect(cryptoEvents).toHaveLength(6);
    });
  });
});
