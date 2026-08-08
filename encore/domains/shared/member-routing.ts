// Author: Klaasvaakie ( |╲ )

export const INTERNATIONAL_CITIZENSHIP_TYPES = [
  "SA_CITIZEN_ABROAD",
  "FOREIGN_CITIZEN_ABROAD",
  "INTL_COMPANY",
] as const;

export type InternationalCitizenshipType = (typeof INTERNATIONAL_CITIZENSHIP_TYPES)[number];

export type KycRail = "instapay" | "kasihub_international";
export type PaymentRail = "instapay" | "usdt";

export interface MemberRoutingDecision {
  isInternational: boolean;
  kycRail: KycRail;
  paymentRail: PaymentRail;
}

const internationalTypes = new Set<string>(INTERNATIONAL_CITIZENSHIP_TYPES);

export function isInternationalCitizenship(citizenshipType: string | null | undefined): citizenshipType is InternationalCitizenshipType {
  return Boolean(citizenshipType && internationalTypes.has(citizenshipType));
}

/**
 * Server-authoritative routing for KYC and payment rails.
 *
 * Local / InstaPay-supported members:
 *   - KYC: InstaPay
 *   - payment/wallet: InstaPay
 *
 * International members:
 *   - KYC: Kasihub-owned international KYC
 *   - payment: provider-independent USDT attestation
 *
 * The client must never be allowed to choose these rails directly.
 */
export function resolveMemberRouting(citizenshipType: string | null | undefined): MemberRoutingDecision {
  const isInternational = isInternationalCitizenship(citizenshipType);
  return isInternational
    ? { isInternational: true, kycRail: "kasihub_international", paymentRail: "usdt" }
    : { isInternational: false, kycRail: "instapay", paymentRail: "instapay" };
}
