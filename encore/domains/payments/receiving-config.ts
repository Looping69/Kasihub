// Author: Klaasvaakie ( |╲ )
import { normalizeChainAddress } from "./chains/address";
import type { SupportedPaymentNetwork } from "./chains/types";

export type ReceivingProvider = "kasihub" | "remitano";
export const RECEIVING_PROVIDERS: [ReceivingProvider, ReceivingProvider] = ["kasihub", "remitano"];

/**
 * Proves that a configured receiver and token contract can be compared to
 * on-chain transfer logs for its selected network. It deliberately does not
 * decide which token contract is official; that is an operator-controlled,
 * independently verified release input. ( |╲ ) — Klaasvaakie
 */
export function validateReceivingRoute(
  network: SupportedPaymentNetwork,
  addressReference: string,
  tokenContract: string,
): void {
  normalizeChainAddress(network, addressReference);
  normalizeChainAddress(network, tokenContract);
}
