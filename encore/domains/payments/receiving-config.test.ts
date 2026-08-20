// Author: Klaasvaakie ( |╲ )
import { describe, expect, it } from "vitest";
import { validateReceivingProviderPolicy, validateReceivingRoute } from "./receiving-config";

describe("receiving route validation", () => {
  it("accepts chain-native receiver and token representations", () => {
    expect(() => validateReceivingRoute(
      "tron",
      "TA9h822trLafTtsGXQc4g4ehPvyNzkQNsS",
      "4101fba20cb405734c6b2e704b9ed67c0b5ea74d9e",
    )).not.toThrow();
    expect(() => validateReceivingRoute(
      "bsc",
      "0x01fba20cb405734c6b2e704b9ed67c0b5ea74d9e",
      "01fba20cb405734c6b2e704b9ed67c0b5ea74d9e",
    )).not.toThrow();
  });

  it("rejects malformed receiver or token inputs before a route can be activated", () => {
    expect(() => validateReceivingRoute("tron", "not-a-tron-address", "4101fba20cb405734c6b2e704b9ed67c0b5ea74d9e")).toThrow();
    expect(() => validateReceivingRoute("bsc", "0x01fba20cb405734c6b2e704b9ed67c0b5ea74d9e", "not-an-evm-address")).toThrow();
  });

  it("requires provider reconciliation for every Remitano inbound route", () => {
    expect(() => validateReceivingProviderPolicy("remitano", true)).not.toThrow();
    expect(() => validateReceivingProviderPolicy("remitano", false)).toThrow(
      "remitano_inbound_routes_require_custody_reconciliation",
    );
    expect(() => validateReceivingProviderPolicy("kasihub", true)).toThrow(
      "custody_reconciliation_requires_supported_provider",
    );
  });
});
