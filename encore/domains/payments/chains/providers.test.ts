// Author: Klaasvaakie ( |╲ )
import { describe, expect, it } from "vitest";
import { tronRpcHeaders } from "./providers";

describe("Tron RPC credentials", () => {
  it("keeps the provider key in a request header and trims accidental whitespace", () => {
    expect(tronRpcHeaders("  staging-trongrid-key  ")).toEqual({
      "Content-Type": "application/json",
      "TRON-PRO-API-KEY": "staging-trongrid-key",
    });
  });

  it("fails closed when the managed secret is missing", () => {
    expect(() => tronRpcHeaders("   ")).toThrow("missing_tron_rpc_api_key");
  });
});
