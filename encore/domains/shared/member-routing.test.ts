// Author: Klaasvaakie ( |╲ )
import { describe, expect, it } from "vitest";
import { resolveMemberRouting, resolveRegistrationPolicy, resolveRegistrationRouting } from "./member-routing";

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

  it.each([undefined, null, "", "UNKNOWN"])("fails closed for unsupported citizenship %s", (citizenshipType) => {
    expect(() => resolveMemberRouting(citizenshipType)).toThrow("unsupported_citizenship_type");
  });
});

describe("resolveRegistrationPolicy", () => {
  it("derives the local individual plan and profile type", () => {
    expect(resolveRegistrationPolicy("SA_CITIZEN_SA", "INDIVIDUAL_ADULT")).toMatchObject({
      isInternational: false,
      kycRail: "instapay",
      paymentRail: "instapay",
      profileType: "individual",
      membershipPlanCode: "INDIVIDUAL_LOCAL",
      kycRequired: true,
    });
  });

  it("derives the international company plan and KYC rail", () => {
    expect(resolveRegistrationPolicy("INTL_COMPANY", "COMPANY")).toMatchObject({
      isInternational: true,
      kycRail: "kasihub_international",
      paymentRail: "usdt",
      profileType: "company",
      membershipPlanCode: "COMPANY_INTERNATIONAL",
      kycRequired: true,
    });
  });

  it("routes a local applicant who opts out of InstaPay through KaSiHub KYC and USDT", () => {
    expect(resolveRegistrationRouting("SA_CITIZEN_SA", "kasihub")).toEqual({
      isInternational: false,
      kycRail: "kasihub_international",
      paymentRail: "usdt",
    });
    expect(resolveRegistrationPolicy("SA_CITIZEN_SA", "INDIVIDUAL_ADULT", "kasihub")).toMatchObject({
      kycRail: "kasihub_international",
      paymentRail: "usdt",
    });
  });

  it("never lets an international applicant select the InstaPay authority", () => {
    expect(resolveRegistrationRouting("FOREIGN_CITIZEN_ABROAD", "instapay")).toMatchObject({
      isInternational: true,
      kycRail: "kasihub_international",
      paymentRail: "usdt",
    });
  });

  it("derives minor profiles without letting the client choose profile type", () => {
    expect(resolveRegistrationPolicy("FOREIGN_CITIZEN_ABROAD", "INDIVIDUAL_KIDS").profileType).toBe("minor");
  });

  it("rejects unsupported membership types", () => {
    expect(() => resolveRegistrationPolicy("SA_CITIZEN_SA", "VIP_SECRET_PLAN")).toThrow("unsupported_membership_type");
  });
});
