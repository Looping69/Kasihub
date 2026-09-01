// Author: Klaasvaakie ( |╲ )
import { describe, expect, it } from "vitest";
import { remitanoDepositRequestTarget } from "./remitano";

const HASH = "a".repeat(64);

describe("Remitano deposit lookup", () => {
  it("restores the 0x prefix for BSC hashes", () => {
    const target = remitanoDepositRequestTarget({
      network: "bsc",
      transactionHash: HASH,
      currency: "USDT",
    });

    expect(target).toContain("coin_currency=usdt");
    expect(target).toContain(`tx_hash=0x${HASH}`);
  });

  it("keeps TRON hashes prefix-free", () => {
    const target = remitanoDepositRequestTarget({
      network: "tron",
      transactionHash: HASH,
      currency: "USDT",
    });

    expect(target).toContain(`tx_hash=${HASH}`);
    expect(target).not.toContain("tx_hash=0x");
  });
});
