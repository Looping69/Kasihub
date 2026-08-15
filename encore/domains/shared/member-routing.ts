// Author: Klaasvaakie ( |╲ )

export const CITIZENSHIP_TYPES = [
  "SA_CITIZEN_SA",
  "FOREIGN_CITIZEN_SA",
  "SA_CIPC_COMPANY",
  "SA_SOLE_PROPRIETOR",
  "SA_NPO_NGO",
  "SA_CITIZEN_ABROAD",
  "FOREIGN_CITIZEN_ABROAD",
  "INTL_COMPANY",
] as const;

export type CitizenshipType = (typeof CITIZENSHIP_TYPES)[number];

export const INTERNATIONAL_CITIZENSHIP_TYPES = [
  "SA_CITIZEN_ABROAD",
  "FOREIGN_CITIZEN_ABROAD",
  "INTL_COMPANY",
] as const satisfies readonly CitizenshipType[];

export type InternationalCitizenshipType = (typeof INTERNATIONAL_CITIZENSHIP_TYPES)[number];

export const MEMBERSHIP_TYPES = [
  "INDIVIDUAL_ADULT",
  "INDIVIDUAL_KIDS",
  "COMPANY",
  "SOLE_PROPRIETOR",
  "NPO_NGO",
  "FREE",
] as const;

export type MembershipType = (typeof MEMBERSHIP_TYPES)[number];
export type KycRail = "instapay" | "kasihub_international";
export type PaymentRail = "instapay" | "usdt";
export type ProfileType = "individual" | "company" | "minor";

export interface MemberRoutingDecision {
  isInternational: boolean;
  kycRail: KycRail;
  paymentRail: PaymentRail;
}

export interface RegistrationPolicy extends MemberRoutingDecision {
  citizenshipType: CitizenshipType;
  membershipType: MembershipType;
  profileType: ProfileType;
  membershipPlanCode: "INDIVIDUAL_LOCAL" | "INDIVIDUAL_INTERNATIONAL" | "COMPANY_LOCAL" | "COMPANY_INTERNATIONAL";
  kycRequired: true;
}

const knownCitizenshipTypes = new Set<string>(CITIZENSHIP_TYPES);
const internationalTypes = new Set<string>(INTERNATIONAL_CITIZENSHIP_TYPES);
const knownMembershipTypes = new Set<string>(MEMBERSHIP_TYPES);

export function isKnownCitizenshipType(citizenshipType: string | null | undefined): citizenshipType is CitizenshipType {
  return Boolean(citizenshipType && knownCitizenshipTypes.has(citizenshipType));
}

export function isKnownMembershipType(membershipType: string | null | undefined): membershipType is MembershipType {
  return Boolean(membershipType && knownMembershipTypes.has(membershipType));
}

export function isInternationalCitizenship(citizenshipType: string | null | undefined): citizenshipType is InternationalCitizenshipType {
  return Boolean(citizenshipType && internationalTypes.has(citizenshipType));
}

/**
 * Server-authoritative routing for KYC and payment rails.
 *
 * This function deliberately fails closed. Missing or unknown citizenship
 * values must never silently inherit the local/InstaPay trust path.
 */
export function resolveMemberRouting(citizenshipType: string | null | undefined): MemberRoutingDecision {
  if (!isKnownCitizenshipType(citizenshipType)) {
    throw new Error("unsupported_citizenship_type");
  }

  const isInternational = isInternationalCitizenship(citizenshipType);
  return isInternational
    ? { isInternational: true, kycRail: "kasihub_international", paymentRail: "usdt" }
    : { isInternational: false, kycRail: "instapay", paymentRail: "instapay" };
}

export function resolveRegistrationRouting(
  citizenshipType: string | null | undefined,
  onboardingAuthority: "instapay" | "kasihub" | null | undefined,
): MemberRoutingDecision {
  const base = resolveMemberRouting(citizenshipType);
  if (base.isInternational) return base;
  if (onboardingAuthority === "kasihub") {
    return { isInternational: false, kycRail: "kasihub_international", paymentRail: "usdt" };
  }
  if (onboardingAuthority === "instapay") return base;
  throw new Error("unsupported_onboarding_authority");
}

/**
 * Derives all registration-sensitive choices from server-owned policy.
 * The client may describe the member, but it may not choose the KYC rail,
 * payment rail, profile type, or membership plan code.
 */
export function resolveRegistrationPolicy(
  citizenshipType: string | null | undefined,
  membershipType: string | null | undefined,
  onboardingAuthority?: "instapay" | "kasihub" | null,
): RegistrationPolicy {
  if (!isKnownCitizenshipType(citizenshipType)) {
    throw new Error("unsupported_citizenship_type");
  }
  if (!isKnownMembershipType(membershipType)) {
    throw new Error("unsupported_membership_type");
  }

  const routing = resolveRegistrationRouting(
    citizenshipType,
    onboardingAuthority ?? (isInternationalCitizenship(citizenshipType) ? "kasihub" : "instapay"),
  );
  const isCompany = membershipType === "COMPANY" || membershipType === "SOLE_PROPRIETOR" || membershipType === "NPO_NGO";
  const profileType: ProfileType = membershipType === "INDIVIDUAL_KIDS"
    ? "minor"
    : isCompany
      ? "company"
      : "individual";
  const membershipPlanCode = `${isCompany ? "COMPANY" : "INDIVIDUAL"}_${routing.isInternational ? "INTERNATIONAL" : "LOCAL"}` as RegistrationPolicy["membershipPlanCode"];

  return {
    ...routing,
    citizenshipType,
    membershipType,
    profileType,
    membershipPlanCode,
    kycRequired: true,
  };
}
