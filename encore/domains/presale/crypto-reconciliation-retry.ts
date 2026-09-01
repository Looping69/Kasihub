// Author: Klaasvaakie ( |╲ )

export const PRESALE_CRYPTO_RETRYABLE_STATUSES = ["pending_confirmations", "retryable"] as const;

export function shouldRetryPresaleCryptoReconciliation(status: string): boolean {
  return (PRESALE_CRYPTO_RETRYABLE_STATUSES as readonly string[]).includes(status);
}
