// Author: Klaasvaakie ( |╲ )
import { describe, expect, it } from "vitest";
import { normalizeTransactionHash, transactionHashForRpc } from "./hash";

const HASH = "A".repeat(64);

describe("transaction hash canonicalization", () => {
  it("normalizes case and EVM presentation prefixes", () => {
    expect(normalizeTransactionHash(`  0x${HASH}  `)).toBe("a".repeat(64));
    expect(normalizeTransactionHash(HASH)).toBe("a".repeat(64));
  });

  it("uses one canonical storage form for replay protection", () => {
    expect(normalizeTransactionHash(`0x${HASH}`)).toBe(normalizeTransactionHash(HASH));
  });

  it("formats canonical hashes for each RPC family", () => {
    const canonical = "b".repeat(64);
    expect(transactionHashForRpc("bsc", canonical)).toBe(`0x${canonical}`);
    expect(transactionHashForRpc("tron", canonical)).toBe(canonical);
  });

  it("rejects malformed hashes", () => {
    expect(() => normalizeTransactionHash("abc")).toThrow("invalid_transaction_hash");
    expect(() => normalizeTransactionHash("g".repeat(64))).toThrow("invalid_transaction_hash");
  });
});
