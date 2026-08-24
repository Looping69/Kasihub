// Author: Klaasvaakie ( |╲ )

export type ApplicantSignupStep = 1 | 2 | 3 | 4 | 5;

export type ApplicantContinuationReason =
  | "resume"
  | "resume_credential_unavailable"
  | "no_application"
  | "invitation_unavailable"
  | "application_not_editable"
  | "reservation_in_progress"
  | "signup_complete";

export interface ApplicantContinuationDecision {
  nextStep: ApplicantSignupStep | null;
  reason: ApplicantContinuationReason;
}

interface ApplicantContinuationState {
  application: null | { status: string; phaseCompleted: number; hasResumeCredential: boolean; resumeAccessAvailable: boolean };
  kycStatus: string | null;
  orderStatus: string | null;
}

const REOPENABLE_ORDER_STATUSES = new Set(["cancelled", "expired"]);
const COMPLETED_ORDER_STATUSES = new Set(["confirmed", "incorporated"]);

function incompleteStep(phaseCompleted: number, kycStatus: string | null): ApplicantSignupStep {
  const phase = Math.max(0, Math.min(5, Math.trunc(phaseCompleted)));
  if (phase < 4) return (phase + 1) as ApplicantSignupStep;
  if (kycStatus?.toLowerCase() !== "approved") return 4;
  return 5;
}

/**
 * Derives the next signup step exclusively from persisted application, KYC, and order state.
 * Browser query parameters never participate in this decision.
 */
export function deriveApplicantContinuation(state: ApplicantContinuationState): ApplicantContinuationDecision {
  if (!state.application) return { nextStep: null, reason: "no_application" };

  if (state.orderStatus && !REOPENABLE_ORDER_STATUSES.has(state.orderStatus)) {
    return {
      nextStep: null,
      reason: COMPLETED_ORDER_STATUSES.has(state.orderStatus) ? "signup_complete" : "reservation_in_progress",
    };
  }
  if (state.application.status !== "draft") return { nextStep: null, reason: "application_not_editable" };
  if (!state.application.resumeAccessAvailable) return { nextStep: null, reason: "invitation_unavailable" };

  const nextStep = incompleteStep(state.application.phaseCompleted, state.kycStatus);
  if (!state.application.hasResumeCredential) {
    return { nextStep, reason: "resume_credential_unavailable" };
  }
  return { nextStep, reason: "resume" };
}
