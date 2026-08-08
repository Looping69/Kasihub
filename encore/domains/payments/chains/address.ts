// Author: Klaasvaakie ( |╲ )
import { createHash } from "node:crypto";
import { normalizeLogAddress } from "./transfer";

const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const base58Values = new Map([...BASE58_ALPHABET].map((char, index) => [char, index]));

function sha256(value: Buffer): Buffer {
  return createHash("sha256").update(value).digest();
}

function decodeBase58(value: string): Buffer {
  if (!value) throw new Error("invalid_base58_address");
  let number = 0n;
  for (const char of value) {
    const digit = base58Values.get(char);
    if (digit === undefined) throw new Error("invalid_base58_address");
    number = number * 58n + BigInt(digit);
  }

  let hex = number.toString(16);
  if (hex.length % 2) hex = `0${hex}`;
  let decoded = hex === "00" ? Buffer.alloc(0) : Buffer.from(hex, "hex");
  let leadingZeroes = 0;
  for (const char of value) {
    if (char !== "1") break;
    leadingZeroes += 1;
  }
  if (leadingZeroes) decoded = Buffer.concat([Buffer.alloc(leadingZeroes), decoded]);
  return decoded;
}

function decodeBase58Check(value: string): Buffer {
  const decoded = decodeBase58(value);
  if (decoded.length < 5) throw new Error("invalid_base58check_address");
  const payload = decoded.subarray(0, -4);
  const checksum = decoded.subarray(-4);
  const expected = sha256(sha256(payload)).subarray(0, 4);
  if (!checksum.equals(expected)) throw new Error("invalid_base58check_checksum");
  return payload;
}

export function normalizeBscAddress(value: string): string {
  return normalizeLogAddress(value);
}

/**
 * Converts all accepted TRON address presentations to the 20-byte lowercase
 * hexadecimal form used by Solidity/event logs.
 *
 * Accepted input:
 * - Base58Check `T...` address
 * - 21-byte TRON hex with `41` prefix
 * - 20-byte EVM-compatible hex, with or without 0x
 */
export function normalizeTronAddress(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith("T")) {
    const payload = decodeBase58Check(trimmed);
    if (payload.length !== 21 || payload[0] !== 0x41) throw new Error("invalid_tron_address_payload");
    return payload.subarray(1).toString("hex");
  }

  const hex = trimmed.toLowerCase().replace(/^0x/, "");
  if (/^41[0-9a-f]{40}$/.test(hex)) return hex.slice(2);
  return normalizeLogAddress(hex);
}

export function normalizeChainAddress(network: "tron" | "bsc", value: string): string {
  return network === "tron" ? normalizeTronAddress(value) : normalizeBscAddress(value);
}
