// Author: Klaasvaakie ( |╲ )
import { describe, expect, it } from "vitest";
import { resolveMemberRouting } from "./member-routing";

describe("resolveMemberRouting", () => {
  it.each([
    "SA_CITIZEN_ABROAD",
    "FOREIGN_CITIZEN_ABROAD",
    "INTL_COMPANY",
  ])("routes %s through Kasihub KYC and USDT", (citizenshipType) => {
    expect(resolveMemberRouting(citizenshipType)).toEqual({
      isInternational: true,
      kycRail: "kasihub_international",
      paymentRail: "usdt",
    });
  });

  it.each([
    "SA_CITIZEN_SA",
    "FOREIGN_CITIZEN_SA",
    "SA_CIPC_COMPANY",
    "SA_SOLE_PROPRIETOR",
    "SA_NPO_NGO",
  ])("routes %s through InstaPay", (citizenshipType) => {
    expect(resolveMemberRouting(citizenshipType)).toEqual({
      isInternational: false,
      kycRail: "instapay",
      paymentRail: "instapay",
    });
  });
});
