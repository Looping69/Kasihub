// Author: Klaasvaakie ( |╲ )

export const TOKEN_TRANSFER_TOPIC = "ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

export interface ChainLog {
  address: string;
  topics: string[];
  data: string;
}

export interface TokenTransfer {
  tokenContract: string;
  sender: string;
  receiver: string;
  amountUnits: bigint;
}

function stripHexPrefix(value: string): string {
  return value.trim().toLowerCase().replace(/^0x/, "");
}

/**
 * Normalizes an EVM-compatible 20-byte address to exactly 40 lowercase hex
 * characters. TRON event logs expose contract/account addresses in the same
 * 20-byte EVM-compatible form, even though user-facing TRON addresses normally
 * carry the 0x41 network prefix/Base58Check representation.
 */
export function normalizeLogAddress(value: string): string {
  const hex = stripHexPrefix(value);
  if (!/^[0-9a-f]{40}$/.test(hex)) throw new Error("invalid_log_address");
  return hex;
}

function addressFromIndexedTopic(topic: string): string {
  const hex = stripHexPrefix(topic);
  if (!/^[0-9a-f]{64}$/.test(hex)) throw new Error("invalid_indexed_address_topic");
  return normalizeLogAddress(hex.slice(24));
}

function uint256FromData(data: string): bigint {
  const hex = stripHexPrefix(data);
  if (!/^[0-9a-f]{64}$/.test(hex)) throw new Error("invalid_uint256_data");
  return BigInt(`0x${hex}`);
}

export function parseTokenTransferLog(log: ChainLog): TokenTransfer | null {
  if (log.topics.length < 3) return null;
  const signature = stripHexPrefix(log.topics[0] ?? "");
  if (signature !== TOKEN_TRANSFER_TOPIC) return null;

  return {
    tokenContract: normalizeLogAddress(log.address),
    sender: addressFromIndexedTopic(log.topics[1] ?? ""),
    receiver: addressFromIndexedTopic(log.topics[2] ?? ""),
    amountUnits: uint256FromData(log.data),
  };
}

export interface MatchingTransferSummary {
  transfers: TokenTransfer[];
  totalUnits: bigint;
}

/**
 * Returns only Transfer events emitted by the exact configured token contract
 * and delivered to the exact configured receiving address. Multiple matching
 * transfers within one transaction are summed using bigint arithmetic.
 */
export function matchingTokenTransfers(
  logs: ChainLog[],
  tokenContract: string,
  receiver: string,
): MatchingTransferSummary {
  const expectedToken = normalizeLogAddress(tokenContract);
  const expectedReceiver = normalizeLogAddress(receiver);
  const transfers: TokenTransfer[] = [];
  let totalUnits = 0n;

  for (const log of logs) {
    let transfer: TokenTransfer | null;
    try {
      transfer = parseTokenTransferLog(log);
    } catch {
      continue;
    }
    if (!transfer) continue;
    if (transfer.tokenContract !== expectedToken || transfer.receiver !== expectedReceiver) continue;
    transfers.push(transfer);
    totalUnits += transfer.amountUnits;
  }

  return { transfers, totalUnits };
}
