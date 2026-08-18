// Author: Klaasvaakie ( |╲ )
import { z } from "zod";

export const INVESTOR_APPLICATION_SCHEMA_VERSION = "2026-08-18-draft-v1";

export interface StructuredAddress {
  line1: string;
  line2?: string;
  city: string;
  region?: string;
  postalCode: string;
  country: string;
}

export interface PhaseOneApplicant {
  applicantType: "individual" | "company" | "trust";
  legalName: string;
  surname?: string;
  identityType: "national_id" | "passport" | "registration" | "authority_number";
  identityNumber: string;
  dateOfBirth?: string;
  nationality: string;
  taxNumber?: string;
  occupation?: string;
  employer?: string;
  mobileNumber: string;
  alternativeNumber?: string;
  emailAddress: string;
  physicalAddress: StructuredAddress;
  postalAddress: { sameAsPhysical: boolean; address?: StructuredAddress };
  entity?: {
    name: string;
    registrationNumber: string;
    vatNumber?: string;
    incomeTaxNumber?: string;
    registeredAddress: StructuredAddress;
    authorisedRepresentative: { name: string; position: string; identityNumber: string; mobileNumber: string; emailAddress: string };
  };
}

const optionalText = (maximum: number) => z.string().trim().max(maximum).optional();
const requiredText = (maximum: number) => z.string().trim().min(1).max(maximum);

export const structuredAddressSchema = z.object({
  line1: requiredText(200),
  line2: optionalText(200),
  city: requiredText(120),
  region: optionalText(120),
  postalCode: requiredText(30),
  country: requiredText(100),
});

export const phaseOneApplicantSchema = z.object({
  applicantType: z.enum(["individual", "company", "trust"]),
  legalName: requiredText(200),
  surname: optionalText(120),
  identityType: z.enum(["national_id", "passport", "registration", "authority_number"]),
  identityNumber: requiredText(160),
  dateOfBirth: optionalText(20),
  nationality: requiredText(100),
  taxNumber: optionalText(100),
  occupation: optionalText(160),
  employer: optionalText(200),
  mobileNumber: requiredText(40),
  alternativeNumber: optionalText(40),
  emailAddress: z.string().trim().email().max(254),
  physicalAddress: structuredAddressSchema,
  postalAddress: z.object({ sameAsPhysical: z.boolean(), address: structuredAddressSchema.optional() }),
  entity: z.object({
    name: requiredText(200),
    registrationNumber: requiredText(160),
    vatNumber: optionalText(100),
    incomeTaxNumber: optionalText(100),
    registeredAddress: structuredAddressSchema,
    authorisedRepresentative: z.object({
      name: requiredText(200),
      position: requiredText(160),
      identityNumber: requiredText(160),
      mobileNumber: requiredText(40),
      emailAddress: z.string().trim().email().max(254),
    }),
  }).optional(),
}).superRefine((value, context) => {
  // Conditional identity rules remain server-owned. Author: Klaasvaakie ( |╲ )
  if (value.applicantType === "individual") {
    if (!value.surname) context.addIssue({ code: "custom", path: ["surname"], message: "Surname is required for an individual" });
    if (!value.dateOfBirth) context.addIssue({ code: "custom", path: ["dateOfBirth"], message: "Date of birth is required for an individual" });
    if (value.entity) context.addIssue({ code: "custom", path: ["entity"], message: "Entity details are not accepted for an individual" });
  } else if (!value.entity) {
    context.addIssue({ code: "custom", path: ["entity"], message: "Company or trust details are required" });
  }
  if (!value.postalAddress.sameAsPhysical && !value.postalAddress.address) {
    context.addIssue({ code: "custom", path: ["postalAddress", "address"], message: "Postal address is required" });
  }
});

export const applicationTransitions: Readonly<Record<string, readonly string[]>> = {
  draft: ["submitted", "withdrawn", "expired"],
  submitted: ["compliance_review", "withdrawn"],
  compliance_review: ["information_required", "compliance_cleared", "compliance_rejected"],
  information_required: ["resubmitted", "withdrawn", "expired"],
  resubmitted: ["compliance_review", "withdrawn"],
  compliance_cleared: ["exco_review"],
  exco_review: ["exco_approved", "exco_rejected", "information_required"],
  exco_approved: ["accepted"],
} as const;

export function canTransitionApplication(from: string, to: string): boolean {
  return applicationTransitions[from]?.includes(to) ?? false;
}
