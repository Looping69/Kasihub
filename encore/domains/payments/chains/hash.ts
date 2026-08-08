// Author: Klaasvaakie ( |╲ )

/**
 * Canonical storage form for supported 32-byte transaction hashes.
 *
 * BSC/EVM callers commonly use a 0x prefix while TRON commonly does not. We
 * remove the presentation prefix and store exactly 64 lowercase hex chars so
 * replay protection cannot be bypassed with prefix/case variations.
 */
export function normalizeTransactionHash(value: string): string {
  const trimmed = value.trim().toLowerCase();
  const withoutPrefix = trimmed.startsWith("0x") ? trimmed.slice(2) : trimmed;
  if (!/^[0-9a-f]{64}$/.test(withoutPrefix)) {
    throw new Error("invalid_transaction_hash");
  }
  return withoutPrefix;
}

export function transactionHashForRpc(network: "tron" | "bsc", canonicalHash: string): string {
  const normalized = normalizeTransactionHash(canonicalHash);
  return network === "bsc" ? `0x${normalized}` : normalized;
}
