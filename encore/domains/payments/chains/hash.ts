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

/**
 * Validates the user-facing representation for the selected chain before
 * converting it to the shared canonical storage form.
 */
export function normalizeSubmittedTransactionHash(network: "tron" | "bsc", value: string): string {
  const trimmed = value.trim();
  const valid = network === "bsc"
    ? /^0x[0-9a-f]{64}$/i.test(trimmed)
    : /^[0-9a-f]{64}$/i.test(trimmed);
  if (!valid) throw new Error(`invalid_${network}_transaction_hash`);
  return normalizeTransactionHash(trimmed);
}

export function transactionHashForRpc(network: "tron" | "bsc", canonicalHash: string): string {
  const normalized = normalizeTransactionHash(canonicalHash);
  return network === "bsc" ? `0x${normalized}` : normalized;
}
