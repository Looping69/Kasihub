// Author: Klaasvaakie ( |╲ )
import { describe, expect, test } from "vitest";
import { submittedTransactionHashPattern, validSubmittedTransactionHash } from "./payment-transaction-hash";

const HASH = "ab".repeat(32);

describe("client transaction hash validation", () => {
  test("matches the exact BSC and TRON backend submission formats", () => {
    expect(validSubmittedTransactionHash("bsc", `0x${HASH}`)).toBe(true);
    expect(validSubmittedTransactionHash("bsc", HASH)).toBe(false);
    expect(validSubmittedTransactionHash("tron", HASH)).toBe(true);
    expect(validSubmittedTransactionHash("tron", `0x${HASH}`)).toBe(false);
  });

  test("provides native-input patterns aligned with the validators", () => {
    expect(submittedTransactionHashPattern("bsc")).toBe("0x[0-9a-fA-F]{64}");
    expect(submittedTransactionHashPattern("tron")).toBe("[0-9a-fA-F]{64}");
  });
});
