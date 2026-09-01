// Author: Klaasvaakie ( |╲ )
import { transactionHashForRpc } from "./chains/hash";
import type { SupportedPaymentNetwork } from "./chains/types";

type RemitanoDepositLookup = {
  network: SupportedPaymentNetwork;
  transactionHash: string;
  currency: string;
};

/**
 * Remitano stores EVM deposits in their chain-facing form (including the 0x
 * prefix). KaSiHub deliberately stores hashes without presentation prefixes
 * for replay protection, so the provider lookup must restore the network form.
 */
export function remitanoDepositRequestTarget(lookup: RemitanoDepositLookup): string {
  const query = new URLSearchParams({
    coin_currency: lookup.currency.toLowerCase(),
    tx_hash: transactionHashForRpc(lookup.network, lookup.transactionHash),
  });
  return `/api/v1/coin_deposits/by_currency_and_tx_hash?${query}`;
}
