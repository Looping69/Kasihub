// Author: Klaasvaakie ( |╲ )
import { APIError } from "encore.dev/api";
import { identityDb, kycDb } from "../../resources";
import { isInternationalCitizenship } from "../shared/member-routing";

export const INTERNATIONAL_KYC_PROVIDER = "kasihub_international" as const;

export type InternationalKycVerification = {
  required: boolean;
  verified: boolean;
  status: "NOT_REQUIRED" | "NONE" | "PENDING" | "VERIFIED" | "REJECTED";
  caseId: string | null;
};

export async function getInternationalKycVerification(profileId: string): Promise<InternationalKycVerification> {
  const profile = await identityDb.rawQueryRow<{ citizenship_type: string | null }>(
    "SELECT citizenship_type FROM profiles WHERE id = $1",
    profileId,
  );
  if (!profile) throw APIError.notFound("Profile not found");

  if (!isInternationalCitizenship(profile.citizenship_type)) {
    return { required: false, verified: true, status: "NOT_REQUIRED", caseId: null };
  }

  const kycCase = await kycDb.rawQueryRow<{ id: string; status: string }>(
    `SELECT id, status
       FROM kyc_cases
      WHERE profile_id = $1 AND provider = $2
      ORDER BY submitted_at DESC NULLS LAST
      LIMIT 1`,
    profileId,
    INTERNATIONAL_KYC_PROVIDER,
  );

  if (!kycCase) return { required: true, verified: false, status: "NONE", caseId: null };
  if (kycCase.status === "approved") {
    return { required: true, verified: true, status: "VERIFIED", caseId: kycCase.id };
  }
  if (kycCase.status === "rejected") {
    return { required: true, verified: false, status: "REJECTED", caseId: kycCase.id };
  }
  return { required: true, verified: false, status: "PENDING", caseId: kycCase.id };
}

/**
 * Compliance gate for international-only regulated/paid actions.
 * Local profiles do not require Kasihub international KYC because their KYC
 * authority is InstaPay. International profiles must have an approved
 * Kasihub international KYC case before this gate succeeds.
 */
export async function requireInternationalKycVerified(profileId: string): Promise<void> {
  const verification = await getInternationalKycVerification(profileId);
  if (verification.required && !verification.verified) {
    throw APIError.failedPrecondition(`International KYC verification is required (${verification.status})`);
  }
}
