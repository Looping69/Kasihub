// Author: Klaasvaakie ( |╲ )
import { describe, expect, test } from "vitest";
import { fixedUsdt, hashSecret, normalizeEmail, paymentEventMessage, signPaymentEvent, verifyPaymentEvent } from "../../encore/domains/presale/model";

const event = {
  eventId: "evt-001",
  provider: "chain-monitor",
  orderReference: "KSP-ORDER-001",
  txHash: "ABCDEF0123456789",
  network: "TRON",
  tokenContract: "TOKEN-CONTRACT",
  receiverAddress: "RECEIVER-ADDRESS",
  senderAddress: "SENDER-ADDRESS",
  amountUsdt: 250,
  confirmations: 20,
  blockNumber: "123456",
};

describe("presale payment contracts", () => {
  test("normalizes identity and fixed precision values", () => {
    expect(normalizeEmail("  Buyer@Example.COM ")).toBe("buyer@example.com");
    expect(fixedUsdt(25)).toBe("25.000000");
    expect(hashSecret("secret")).toHaveLength(64);
  });

  test("creates one deterministic canonical event message", () => {
    expect(paymentEventMessage(event)).toBe(
      "evt-001|chain-monitor|KSP-ORDER-001|abcdef0123456789|tron|token-contract|receiver-address|sender-address|250.000000|20|123456",
    );
  });

  test("accepts an authentic event and rejects tampering", () => {
    const signature = signPaymentEvent(event, "webhook-secret");
    expect(verifyPaymentEvent(event, "webhook-secret", signature)).toBe(true);
    expect(verifyPaymentEvent({ ...event, amountUsdt: 251 }, "webhook-secret", signature)).toBe(false);
    expect(verifyPaymentEvent(event, "wrong-secret", signature)).toBe(false);
    expect(verifyPaymentEvent(event, "webhook-secret", "invalid")).toBe(false);
  });
});
