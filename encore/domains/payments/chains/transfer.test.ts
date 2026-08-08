// Author: Klaasvaakie ( |╲ )
import { describe, expect, it } from "vitest";
import { matchingTokenTransfers, normalizeLogAddress, parseTokenTransferLog, TOKEN_TRANSFER_TOPIC } from "./transfer";

const TOKEN = "11".repeat(20);
const RECEIVER = "22".repeat(20);
const SENDER = "33".repeat(20);

function addressTopic(address: string): string {
  return `0x${"0".repeat(24)}${address}`;
}

function amountData(value: bigint): string {
  return `0x${value.toString(16).padStart(64, "0")}`;
}

describe("token transfer evidence", () => {
  it("parses the standard indexed-address Transfer event shape", () => {
    expect(parseTokenTransferLog({
      address: `0x${TOKEN}`,
      topics: [`0x${TOKEN_TRANSFER_TOPIC}`, addressTopic(SENDER), addressTopic(RECEIVER)],
      data: amountData(25_000_000n),
    })).toEqual({
      tokenContract: TOKEN,
      sender: SENDER,
      receiver: RECEIVER,
      amountUnits: 25_000_000n,
    });
  });

  it("ignores unrelated event signatures and wrong contracts/receivers", () => {
    const logs = [
      { address: TOKEN, topics: ["00".repeat(32), addressTopic(SENDER), addressTopic(RECEIVER)], data: amountData(10n) },
      { address: "44".repeat(20), topics: [TOKEN_TRANSFER_TOPIC, addressTopic(SENDER), addressTopic(RECEIVER)], data: amountData(20n) },
      { address: TOKEN, topics: [TOKEN_TRANSFER_TOPIC, addressTopic(SENDER), addressTopic("55".repeat(20))], data: amountData(30n) },
    ];
    expect(matchingTokenTransfers(logs, TOKEN, RECEIVER)).toEqual({ transfers: [], totalUnits: 0n });
  });

  it("sums multiple matching transfers using bigint arithmetic", () => {
    const logs = [
      { address: TOKEN, topics: [TOKEN_TRANSFER_TOPIC, addressTopic(SENDER), addressTopic(RECEIVER)], data: amountData(10n) },
      { address: TOKEN, topics: [TOKEN_TRANSFER_TOPIC, addressTopic("66".repeat(20)), addressTopic(RECEIVER)], data: amountData(15n) },
    ];
    const result = matchingTokenTransfers(logs, TOKEN, RECEIVER);
    expect(result.totalUnits).toBe(25n);
    expect(result.transfers).toHaveLength(2);
  });

  it("normalizes only exact 20-byte log addresses", () => {
    expect(normalizeLogAddress(`0x${TOKEN.toUpperCase()}`)).toBe(TOKEN);
    expect(() => normalizeLogAddress("abcd")).toThrow("invalid_log_address");
  });
});
