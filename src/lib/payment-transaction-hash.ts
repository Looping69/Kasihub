// Author: Klaasvaakie ( |╲ )

export type SupportedPaymentNetwork = "bsc" | "tron";

export function submittedTransactionHashPattern(network: SupportedPaymentNetwork): string {
  return network === "bsc" ? "0x[0-9a-fA-F]{64}" : "[0-9a-fA-F]{64}";
}

export function submittedTransactionHashMessage(network: SupportedPaymentNetwork): string {
  return network === "bsc"
    ? "Enter 0x followed by exactly 64 hexadecimal characters for the BSC transaction hash."
    : "Enter exactly 64 hexadecimal characters for the TRON transaction hash.";
}

export function validSubmittedTransactionHash(network: SupportedPaymentNetwork, value: string): boolean {
  const expression = network === "bsc" ? /^0x[0-9a-f]{64}$/i : /^[0-9a-f]{64}$/i;
  return expression.test(value.trim());
}
