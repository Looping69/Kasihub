// Author: Klaasvaakie ( |╲ )
import { describe, expect, test } from "vitest";
import { shouldRetryPresaleCryptoReconciliation } from "./crypto-reconciliation-retry";

describe("presale crypto reconciliation retry policy", () => {
  test.each(["pending_confirmations", "retryable"])("retries %s results", (status) => {
    expect(shouldRetryPresaleCryptoReconciliation(status)).toBe(true);
  });

  test.each(["settled", "rejected", "underpaid", "manual_review"])("acknowledges terminal %s results", (status) => {
    expect(shouldRetryPresaleCryptoReconciliation(status)).toBe(false);
  });
});
