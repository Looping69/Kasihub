// Author: Klaasvaakie ( |╲ )
import { normalizeChainAddress } from "./chains/address";
import type { SupportedPaymentNetwork } from "./chains/types";

export type ReceivingProvider = "kasihub" | "remitano";
export const RECEIVING_PROVIDERS: [ReceivingProvider, ReceivingProvider] = ["kasihub", "remitano"];

/**
 * Remitano is the approved inbound custodian, so a Remitano receiving route
 * must be reconciled against provider evidence before KaSiHub settlement.
 * Direct KaSiHub routes cannot claim custody reconciliation without a
 * supported custodian. ( |╲ ) — Klaasvaakie
 */
export function validateReceivingProviderPolicy(
  provider: ReceivingProvider,
  custodyReconciliationRequired: boolean,
): void {
  if (provider === "remitano" && !custodyReconciliationRequired) {
    throw new Error("remitano_inbound_routes_require_custody_reconciliation");
  }
  if (provider !== "remitano" && custodyReconciliationRequired) {
    throw new Error("custody_reconciliation_requires_supported_provider");
  }
}

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
