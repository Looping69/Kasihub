// Author: Klaasvaakie ( |╲ )
import { describe, expect, it } from "vitest";
import { normalizeBscAddress, normalizeChainAddress, normalizeTronAddress } from "./address";

const TRON_BASE58 = "TA9h822trLafTtsGXQc4g4ehPvyNzkQNsS";
const TRON_HEX = "4101fba20cb405734c6b2e704b9ed67c0b5ea74d9e";
const EVM_HEX = "01fba20cb405734c6b2e704b9ed67c0b5ea74d9e";

describe("chain address normalization", () => {
  it("normalizes official TRON Base58Check and hex examples to one 20-byte form", () => {
    expect(normalizeTronAddress(TRON_BASE58)).toBe(EVM_HEX);
    expect(normalizeTronAddress(TRON_HEX)).toBe(EVM_HEX);
    expect(normalizeTronAddress(`0x${EVM_HEX}`)).toBe(EVM_HEX);
  });

  it("rejects an invalid TRON Base58Check checksum", () => {
    expect(() => normalizeTronAddress(`${TRON_BASE58.slice(0, -1)}T`)).toThrow();
  });

  it("normalizes BSC addresses as exact 20-byte EVM hex", () => {
    expect(normalizeBscAddress(`0x${EVM_HEX.toUpperCase()}`)).toBe(EVM_HEX);
    expect(normalizeChainAddress("bsc", EVM_HEX)).toBe(EVM_HEX);
  });

  it("routes TRON normalization through the chain helper", () => {
    expect(normalizeChainAddress("tron", TRON_BASE58)).toBe(EVM_HEX);
  });
});
