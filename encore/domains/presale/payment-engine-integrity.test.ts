// Author: Klaasvaakie ( |╲ )
import { describe, expect, test, vi } from "vitest";

vi.mock("encore.dev/config", () => ({
  secret: () => () => "mock-secret",
}));
vi.mock("encore.dev", () => ({
  appMeta: () => ({ environment: { type: "development" } }),
}));
import {
  deriveApplicantJourney,
  assertApplicantJourneyTransition,
  APPLICANT_JOURNEY_TRANSITIONS,
  orderJourneyState,
} from "./applicant-journey";
import {
  webPayChecksum,
  verifyWebPayChecksum,
  webPayProcessChecksum,
  verifyWebPayProcessChecksum,
  webPayOrderNumber,
  webPayTotalZar,
} from "./webpay";
import { classifyObligationFunding } from "../payments/settlement-policy";
import { classifyTransactionDeadline } from "../payments/deadline-policy";
import { evaluatePaymentEvidence } from "../payments/chains/evaluate";
import { evaluateCustodyEvidence } from "../payments/custody";
import { canTransitionPayment, assertPaymentTransition } from "../payments/state-machine";

describe("Phase 3: Payment Engine Integrity & Recovery", () => {
  const baseApplicant = {
    application: { status: "draft", phaseCompleted: 4 },
    kycStatus: "approved",
    holdingStatus: null,
  };

  describe("1. WebPay Attempt Lifecycle & Retryability", () => {
    test("keeps start_card_checkout available after prior attempt is started or abandoned", () => {
      // Prior attempt started (cardCheckoutStarted = true)
      const journey = deriveApplicantJourney({
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
      expect(journey.allowedActions).toContain("view_reservation");
    });

    test("generates deterministic yet distinct attempt identifiers across checkouts", () => {
      const orderRef = "KSP-PAYMENT-RETRY-1";
      const orderNumber = webPayOrderNumber("KSH", orderRef);
      expect(orderNumber).toHaveLength(20);
      expect(orderNumber.startsWith("KSH")).toBe(true);

      // Attempt 1 vs Attempt 2 have distinct transaction IDs
      const txId1 = "00000000-0000-0000-0000-000000000001";
      const txId2 = "00000000-0000-0000-0000-000000000002";
      const checksum1 = webPayChecksum({
        merchantUuid: "test-merchant",
        accountUuid: "test-account",
        transactionId: txId1,
        amountZar: "450.00",
        securityKey: "secret-key-12345",
      });
      const checksum2 = webPayChecksum({
        merchantUuid: "test-merchant",
        accountUuid: "test-account",
        transactionId: txId2,
        amountZar: "450.00",
        securityKey: "secret-key-12345",
      });
      expect(checksum1).not.toBe(checksum2);
      expect(verifyWebPayChecksum({
        merchantUuid: "test-merchant",
        accountUuid: "test-account",
        transactionId: txId1,
        amountZar: "450.00",
        securityKey: "secret-key-12345",
      }, checksum1)).toBe(true);
    });
  });

  describe("2. WebPay Callback Authority & Ordering", () => {
    const validParams = {
      merchantUuid: "merch-123",
      accountUuid: "acc-456",
      transactionId: "tx-789",
      amountZar: "900.00",
      securityKey: "test-security-key-32",
    };

    test("verifies genuine provider checksum and rejects tampered values", () => {
      const genuineChecksum = webPayChecksum(validParams);
      expect(verifyWebPayChecksum(validParams, genuineChecksum)).toBe(true);

      // Tampered amount
      expect(verifyWebPayChecksum({ ...validParams, amountZar: "450.00" }, genuineChecksum)).toBe(false);
      // Tampered merchant
      expect(verifyWebPayChecksum({ ...validParams, merchantUuid: "attacker" }, genuineChecksum)).toBe(false);
      // Tampered account
      expect(verifyWebPayChecksum({ ...validParams, accountUuid: "attacker" }, genuineChecksum)).toBe(false);
      // Tampered transaction
      expect(verifyWebPayChecksum({ ...validParams, transactionId: "wrong-tx" }, genuineChecksum)).toBe(false);
    });

    test("verifies WebPay process webhook checksum", () => {
      const processParams = {
        accountUuid: "acc-456",
        processUuid: "proc-123",
        processStage: "return_card_payment",
        securityKey: "test-security-key-32",
      };
      const processChecksum = webPayProcessChecksum(processParams);
      expect(verifyWebPayProcessChecksum(processParams, processChecksum)).toBe(true);
      expect(verifyWebPayProcessChecksum({ ...processParams, processStage: "invalid" }, processChecksum)).toBe(false);
    });
  });

  describe("3. Late-Payment WebPay Ordering", () => {
    test("maps persisted WebPay order states before callback transition checks", () => {
      expect(orderJourneyState("awaiting_payment")).toBe("awaiting_payment");
      expect(orderJourneyState("payment_submitted")).toBe("payment_submitted");
      expect(orderJourneyState("payment_detected")).toBe("pending_confirmations");
      expect(orderJourneyState("manual_review")).toBe("manual_review");
      expect(orderJourneyState("confirmed", "pending")).toBe("confirmed");
      expect(orderJourneyState("confirmed", "processing")).toBe("awaiting_incorporation");
      expect(orderJourneyState("incorporated")).toBe("issued");
      expect(orderJourneyState("cancelled")).toBe("cancelled");
      expect(orderJourneyState("expired")).toBe("expired");
      expect(() => orderJourneyState("unknown")).toThrow("unmapped_presale_order_status:unknown");
    });

    test("ensures cancelled and expired states have legal transitions to manual_review and not confirmed", () => {
      expect(APPLICANT_JOURNEY_TRANSITIONS.cancelled.legalNext).toContain("manual_review");
      expect(APPLICANT_JOURNEY_TRANSITIONS.cancelled.legalNext).not.toContain("confirmed");

      expect(APPLICANT_JOURNEY_TRANSITIONS.expired.legalNext).toContain("manual_review");
      expect(APPLICANT_JOURNEY_TRANSITIONS.expired.legalNext).not.toContain("confirmed");

      // Assert that asserting transition to confirmed on cancelled throws
      expect(() => assertApplicantJourneyTransition("cancelled", "confirmed")).toThrow("invalid_applicant_journey_transition");
      // But transition to manual_review succeeds
      expect(() => assertApplicantJourneyTransition("cancelled", "manual_review")).not.toThrow();
      expect(() => assertApplicantJourneyTransition("expired", "manual_review")).not.toThrow();
    });
  });

  describe("4. Crypto Canonical Verification & Deadline Authority", () => {
    const deadline = "2026-09-03T12:00:00.000Z";

    test("classifies transaction mined before deadline as on_time regardless of detection time", () => {
      const minedBefore = "2026-09-03T11:59:55.000Z";
      expect(classifyTransactionDeadline(minedBefore, deadline)).toBe("on_time");
    });

    test("classifies transaction mined after deadline as late (routing to manual review)", () => {
      const minedAfter = "2026-09-03T12:00:05.000Z";
      expect(classifyTransactionDeadline(minedAfter, deadline)).toBe("late");
    });

    test("classifies missing block timestamp as manual_review", () => {
      expect(classifyTransactionDeadline(null, deadline)).toBe("manual_review");
    });

    test("evaluates canonical chain evidence strictly on recipient, token, and confirmations", () => {
      const HASH = "a".repeat(64);
      const TOKEN = "55d398326f99059ff775485246999027b3197955";
      const RECEIVER = "22".repeat(20);
      const SENDER = "33".repeat(20);
      const addressTopic = (addr: string) => `0x${"0".repeat(24)}${addr}`;
      const amountData = (value: bigint) => `0x${value.toString(16).padStart(64, "0")}`;

      const expected = {
        network: "bsc" as const,
        transactionHash: HASH,
        tokenContract: `0x${TOKEN}`,
        receivingAddress: `0x${RECEIVER}`,
        expectedAmount: "100.000000",
        tokenDecimals: 18,
        minimumConfirmations: 12,
      };

      // Exact match with sufficient confirmations (115n - 100n + 1n = 16 >= 12)
      const matched = evaluatePaymentEvidence(expected, {
        network: "bsc",
        transactionHash: `0x${HASH}`,
        visible: true,
        execution: "success",
        blockNumber: 100n,
        latestBlockNumber: 115n,
        blockTimestamp: "2026-09-03T11:55:00.000Z",
        sender: `0x${SENDER}`,
        logs: [{
          address: `0x${TOKEN}`,
          topics: ["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef", addressTopic(SENDER), addressTopic(RECEIVER)],
          data: amountData(100_000_000_000_000_000_000n),
        }],
      });
      expect(matched.decision).toBe("confirmed");
      expect(matched.receivedAmount).toBe("100");

      // Insufficient confirmations (105n - 100n + 1n = 6 < 12)
      const pendingConf = evaluatePaymentEvidence(expected, {
        network: "bsc",
        transactionHash: `0x${HASH}`,
        visible: true,
        execution: "success",
        blockNumber: 100n,
        latestBlockNumber: 105n,
        blockTimestamp: "2026-09-03T11:55:00.000Z",
        sender: `0x${SENDER}`,
        logs: [{
          address: `0x${TOKEN}`,
          topics: ["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef", addressTopic(SENDER), addressTopic(RECEIVER)],
          data: amountData(100_000_000_000_000_000_000n),
        }],
      });
      expect(pendingConf.decision).toBe("pending_confirmations");

      // Wrong token contract
      const wrongToken = evaluatePaymentEvidence(expected, {
        network: "bsc",
        transactionHash: `0x${HASH}`,
        visible: true,
        execution: "success",
        blockNumber: 100n,
        latestBlockNumber: 115n,
        blockTimestamp: "2026-09-03T11:55:00.000Z",
        sender: `0x${SENDER}`,
        logs: [{
          address: `0x${"88".repeat(20)}`,
          topics: ["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef", addressTopic(SENDER), addressTopic(RECEIVER)],
          data: amountData(100_000_000_000_000_000_000n),
        }],
      });
      expect(wrongToken.decision).toBe("rejected");
    });
  });

  describe("5. Remitano Custody Reconciliation", () => {
    const CUSTODY_HASH = "b".repeat(64);
    const custodyContext = {
      provider: "remitano",
      network: "bsc" as const,
      transactionHash: CUSTODY_HASH,
      receiverAddress: `0x${"22".repeat(20)}`,
      currency: "USDT",
      expectedAmount: "100.000000",
      tokenDecimals: 18,
    };

    test("confirms when custody evidence matches chain transfer", () => {
      const decision = evaluateCustodyEvidence(custodyContext, {
        outcome: "confirmed",
        provider: "remitano",
        providerReference: "dep-1",
        transactionHash: CUSTODY_HASH,
        receiverAddress: custodyContext.receiverAddress,
        currency: "USDT",
        amount: "100.000000",
        observedAt: "2026-09-03T12:00:00.000Z",
      });
      expect(decision.decision).toBe("confirmed");
    });

    test("routes to manual_review when custody evidence contradicts chain transfer", () => {
      const amountMismatch = evaluateCustodyEvidence(custodyContext, {
        outcome: "confirmed",
        provider: "remitano",
        providerReference: "dep-2",
        transactionHash: CUSTODY_HASH,
        receiverAddress: custodyContext.receiverAddress,
        currency: "USDT",
        amount: "50.000000",
        observedAt: "2026-09-03T12:00:00.000Z",
      });
      expect(amountMismatch.decision).toBe("manual_review");
      expect(amountMismatch.reason).toBe("custody_amount_mismatch");

      const receiverMismatch = evaluateCustodyEvidence(custodyContext, {
        outcome: "confirmed",
        provider: "remitano",
        providerReference: "dep-3",
        transactionHash: CUSTODY_HASH,
        receiverAddress: `0x${"99".repeat(20)}`,
        currency: "USDT",
        amount: "100.000000",
        observedAt: "2026-09-03T12:00:00.000Z",
      });
      expect(receiverMismatch.decision).toBe("manual_review");
      expect(receiverMismatch.reason).toBe("custody_receiver_mismatch");
    });
  });

  describe("6. Cumulative Top-ups & Underpayment Funding", () => {
    test("single underpayment leaves obligation partially_paid", () => {
      const result = classifyObligationFunding("100.000000", ["80.000000"]);
      expect(result.status).toBe("partially_paid");
      expect(result.dueUnits).toBe(100000000n);
      expect(result.creditedUnits).toBe(80000000n);
    });

    test("exact top-up (80 + 20) satisfies obligation into paid", () => {
      const result = classifyObligationFunding("100.000000", ["80.000000", "20.000000"]);
      expect(result.status).toBe("paid");
      expect(result.creditedUnits).toBe(100000000n);
    });

    test("multiple top-ups (40 + 30 + 30) satisfy obligation exactly once", () => {
      const result = classifyObligationFunding("100.000000", ["40.000000", "30.000000", "30.000000"]);
      expect(result.status).toBe("paid");
    });

    test("overpayment (105 for 100, or 80 + 30 = 110) routes to review_required", () => {
      const singleOverpayment = classifyObligationFunding("100.000000", ["105.000000"]);
      expect(singleOverpayment.status).toBe("review_required");

      const topUpOverpayment = classifyObligationFunding("100.000000", ["80.000000", "30.000000"]);
      expect(topUpOverpayment.status).toBe("review_required");
    });

    test("allows underpaid state to transition to submitted on top-up", () => {
      expect(canTransitionPayment("underpaid", "submitted")).toBe(true);
      expect(() => assertPaymentTransition("underpaid", "submitted")).not.toThrow();
    });
  });

  describe("7. Manual Review Operational Resolution", () => {
    test("permits legal journey transition from manual_review to confirmed or cancelled", () => {
      expect(APPLICANT_JOURNEY_TRANSITIONS.manual_review.legalNext).toContain("confirmed");
      expect(APPLICANT_JOURNEY_TRANSITIONS.manual_review.legalNext).toContain("cancelled");
      expect(() => assertApplicantJourneyTransition("manual_review", "confirmed")).not.toThrow();
      expect(() => assertApplicantJourneyTransition("manual_review", "cancelled")).not.toThrow();
    });

    test("blocks illegal transitions from terminal states", () => {
      expect(() => assertApplicantJourneyTransition("revoked", "confirmed")).toThrow("invalid_applicant_journey_transition");
      expect(() => assertApplicantJourneyTransition("issued", "awaiting_payment")).toThrow("invalid_applicant_journey_transition");
    });
  });
});
