import { describe, expect, it } from "vitest";
import { createCryptoPaymentRequest } from "./crypto-payment-request";

const RECEIVER = `0x${"22".repeat(20)}`;
const TOKEN = `0x${"11".repeat(20)}`;

describe("crypto payment requests", () => {
  it("encodes the BSC token, receiver, chain and exact six-decimal amount", () => {
    expect(createCryptoPaymentRequest({
      network: "BSC",
      receivingAddress: RECEIVER,
      tokenContract: TOKEN,
      amountUsdt: "1.000001",
    })).toEqual({
      payload: `ethereum:${TOKEN}@56/transfer?address=${RECEIVER}&uint256=1000001`,
      networkLabel: "BNB Smart Chain (BEP20)",
      includesExactAmount: true,
      guidance: expect.stringContaining("exact reserved amount"),
    });
  });

  it.each([
    ["0", "greater than zero"],
    ["1.0000001", "six decimal places"],
  ])("rejects unsafe USDT amount %s", (amountUsdt, message) => {
    expect(() => createCryptoPaymentRequest({
      network: "bsc",
      receivingAddress: RECEIVER,
      tokenContract: TOKEN,
      amountUsdt,
    })).toThrow(message);
  });

  it("rejects malformed BSC payment routing", () => {
    expect(() => createCryptoPaymentRequest({
      network: "bsc",
      receivingAddress: "0x123",
      tokenContract: TOKEN,
      amountUsdt: "1",
    })).toThrow("Receiving address is not a valid BSC address");
  });

  it("rejects payment networks outside the BSC-only presale policy", () => {
    expect(() => createCryptoPaymentRequest({
      network: "unsupported",
      receivingAddress: RECEIVER,
      tokenContract: TOKEN,
      amountUsdt: "1",
    })).toThrow("BSC payments only");
  });
});
