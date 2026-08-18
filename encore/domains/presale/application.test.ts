// Author: Klaasvaakie ( |╲ )
import { describe, expect, it } from "vitest";
import { canTransitionApplication, phaseOneApplicantSchema } from "./application";

const baseApplicant = {
  applicantType: "individual" as const,
  legalName: "Klaas Example",
  surname: "Example",
  identityType: "national_id" as const,
  identityNumber: "protected-provider-reference",
  dateOfBirth: "1980-01-01",
  nationality: "South African",
  mobileNumber: "+27110000000",
  emailAddress: "owner@example.test",
  physicalAddress: { line1: "1 Main Road", city: "Johannesburg", postalCode: "2000", country: "South Africa" },
  postalAddress: { sameAsPhysical: true },
};

describe("investor application foundation", () => {
  it("accepts a complete individual phase", () => {
    expect(phaseOneApplicantSchema.safeParse(baseApplicant).success).toBe(true);
  });

  it("requires the conditional company or trust identity group", () => {
    expect(phaseOneApplicantSchema.safeParse({ ...baseApplicant, applicantType: "company", surname: undefined, dateOfBirth: undefined }).success).toBe(false);
  });

  it("keeps acceptance behind the EXCO approval state", () => {
    expect(canTransitionApplication("draft", "accepted")).toBe(false);
    expect(canTransitionApplication("exco_approved", "accepted")).toBe(true);
  });
});
