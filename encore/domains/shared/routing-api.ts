// Author: Klaasvaakie ( |╲ )
import { api, APIError } from "encore.dev/api";
import { z } from "zod";
import { resolveRegistrationPolicy } from "./member-routing";

const registrationPolicyRequest = z.object({
  citizenshipType: z.string().min(1).max(100),
  membershipType: z.string().min(1).max(100),
});

export type RegistrationPolicyResponse = {
  isInternational: boolean;
  kycRail: "instapay" | "kasihub_international";
  paymentRail: "instapay" | "usdt";
  profileType: "individual" | "company" | "minor";
  membershipPlanCode: "INDIVIDUAL_LOCAL" | "INDIVIDUAL_INTERNATIONAL" | "COMPANY_LOCAL" | "COMPANY_INTERNATIONAL";
  kycRequired: true;
};

/**
 * Public because registration is pre-authentication. The endpoint returns only
 * policy derived from allowlisted values and never accepts or exposes secrets.
 */
export const registrationPolicy = api<
  { citizenshipType: string; membershipType: string },
  RegistrationPolicyResponse
>(
  { method: "POST", path: "/routing/registration", expose: true },
  async (req) => {
    const payload = registrationPolicyRequest.parse(req);
    try {
      const policy = resolveRegistrationPolicy(payload.citizenshipType, payload.membershipType);
      return {
        isInternational: policy.isInternational,
        kycRail: policy.kycRail,
        paymentRail: policy.paymentRail,
        profileType: policy.profileType,
        membershipPlanCode: policy.membershipPlanCode,
        kycRequired: policy.kycRequired,
      };
    } catch (error) {
      if (error instanceof Error && error.message === "unsupported_citizenship_type") {
        throw APIError.invalidArgument("Unsupported citizenship type");
      }
      if (error instanceof Error && error.message === "unsupported_membership_type") {
        throw APIError.invalidArgument("Unsupported membership type");
      }
      throw error;
    }
  },
);
