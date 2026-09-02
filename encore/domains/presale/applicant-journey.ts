// Author: Klaasvaakie ( |╲ )

export type ApplicantJourneyState =
  | "invite_required"
  | "application_in_progress"
  | "kyc_pending"
  | "eligible_to_reserve"
  | "awaiting_payment"
  | "payment_submitted"
  | "pending_confirmations"
  | "underpaid"
  | "manual_review"
  | "confirmed"
  | "awaiting_incorporation"
  | "issued"
  | "revoked"
  | "cancelled"
  | "expired";

export const APPLICANT_JOURNEY_STATES: readonly ApplicantJourneyState[] = [
  "invite_required",
  "application_in_progress",
  "kyc_pending",
  "eligible_to_reserve",
  "awaiting_payment",
  "payment_submitted",
  "pending_confirmations",
  "underpaid",
  "manual_review",
  "confirmed",
  "awaiting_incorporation",
  "issued",
  "revoked",
  "cancelled",
  "expired",
];

export type ApplicantJourneyAction =
  | "start_with_invitation"
  | "resume_application"
  | "resume_kyc"
  | "refresh_kyc"
  | "create_reservation"
  | "view_reservation"
  | "submit_payment_hash"
  | "start_card_checkout"
  | "recheck_payment"
  | "cancel_reservation"
  | "contact_support"
  | "download_certificate"
  | "verify_certificate";

export type ApplicantJourneyPolling = "none" | "kyc" | "payment" | "incorporation";

export interface ApplicantJourneyDecision {
  state: ApplicantJourneyState;
  reason: string;
  allowedActions: ApplicantJourneyAction[];
  applicationEditable: boolean;
  reservationEditable: boolean;
  polling: ApplicantJourneyPolling;
  terminal: boolean;
}

export type ApplicantJourneyActor = "applicant" | "compliance" | "payment_verifier" | "system" | "issuer";

export interface ApplicantJourneyTransitionPolicy {
  legalNext: readonly ApplicantJourneyState[];
  actors: readonly ApplicantJourneyActor[];
  requiredEvidence: readonly string[];
  reversible: boolean;
  terminal: boolean;
}

export const APPLICANT_JOURNEY_TRANSITIONS: Record<ApplicantJourneyState, ApplicantJourneyTransitionPolicy> = {
  invite_required: { legalNext: ["application_in_progress"], actors: ["applicant"], requiredEvidence: ["active_invitation", "authenticated_profile"], reversible: false, terminal: false },
  application_in_progress: { legalNext: ["kyc_pending", "eligible_to_reserve", "manual_review"], actors: ["applicant", "compliance"], requiredEvidence: ["persisted_application"], reversible: true, terminal: false },
  kyc_pending: { legalNext: ["eligible_to_reserve", "manual_review"], actors: ["compliance"], requiredEvidence: ["provider_kyc_result"], reversible: true, terminal: false },
  eligible_to_reserve: { legalNext: ["awaiting_payment", "manual_review"], actors: ["applicant", "system"], requiredEvidence: ["approved_kyc", "atomic_inventory_reservation"], reversible: true, terminal: false },
  awaiting_payment: { legalNext: ["payment_submitted", "confirmed", "cancelled", "expired", "manual_review"], actors: ["applicant", "payment_verifier", "system"], requiredEvidence: ["persisted_reservation"], reversible: true, terminal: false },
  payment_submitted: { legalNext: ["pending_confirmations", "underpaid", "manual_review", "confirmed"], actors: ["payment_verifier"], requiredEvidence: ["unique_transaction_hash"], reversible: false, terminal: false },
  pending_confirmations: { legalNext: ["pending_confirmations", "underpaid", "manual_review", "confirmed"], actors: ["payment_verifier"], requiredEvidence: ["canonical_chain_evidence"], reversible: false, terminal: false },
  underpaid: { legalNext: ["payment_submitted", "manual_review", "cancelled", "expired"], actors: ["applicant", "payment_verifier", "system"], requiredEvidence: ["canonical_underpayment_evidence"], reversible: true, terminal: false },
  manual_review: { legalNext: ["confirmed", "cancelled", "expired", "revoked"], actors: ["compliance", "issuer"], requiredEvidence: ["audited_manual_decision"], reversible: true, terminal: false },
  confirmed: { legalNext: ["awaiting_incorporation", "manual_review"], actors: ["system", "issuer"], requiredEvidence: ["settled_payment_obligation"], reversible: false, terminal: false },
  awaiting_incorporation: { legalNext: ["issued", "manual_review"], actors: ["issuer", "system"], requiredEvidence: ["idempotent_issuance_operation"], reversible: false, terminal: false },
  issued: { legalNext: ["revoked"], actors: ["issuer"], requiredEvidence: ["sealed_certificate"], reversible: false, terminal: true },
  revoked: { legalNext: [], actors: ["issuer"], requiredEvidence: ["revocation_audit"], reversible: false, terminal: true },
  cancelled: { legalNext: ["manual_review"], actors: ["system", "compliance"], requiredEvidence: ["cancellation_audit"], reversible: false, terminal: true },
  expired: { legalNext: ["manual_review"], actors: ["system", "compliance"], requiredEvidence: ["deadline_evidence"], reversible: false, terminal: true },
};

export function assertApplicantJourneyTransition(from: ApplicantJourneyState, to: ApplicantJourneyState): void {
  if (!APPLICANT_JOURNEY_TRANSITIONS[from].legalNext.includes(to)) {
    throw new Error(`invalid_applicant_journey_transition:${from}->${to}`);
  }
}

export interface ApplicantJourneySource {
  application: null | { status: string; phaseCompleted: number };
  kycStatus: string | null;
  order: null | {
    status: string;
    incorporationStatus: string;
    paymentRail: "remitano_usdt" | "webpay_card";
    paymentVerificationStatus?: string | null;
    hasTransactionHash: boolean;
    cancellationEligible: boolean;
    cardCheckoutStarted?: boolean;
  };
  holdingStatus?: "awaiting_issuance" | "issued" | "revoked" | "issuance_error" | null;
}

type JourneyPresentation = Omit<ApplicantJourneyDecision, "state" | "reason">;

export const APPLICANT_JOURNEY_PRESENTATION: Record<ApplicantJourneyState, JourneyPresentation> = {
  invite_required: {
    allowedActions: ["start_with_invitation"], applicationEditable: false, reservationEditable: false, polling: "none", terminal: false,
  },
  application_in_progress: {
    allowedActions: ["resume_application"], applicationEditable: true, reservationEditable: false, polling: "none", terminal: false,
  },
  kyc_pending: {
    allowedActions: ["resume_kyc", "refresh_kyc"], applicationEditable: true, reservationEditable: false, polling: "kyc", terminal: false,
  },
  eligible_to_reserve: {
    allowedActions: ["resume_application", "create_reservation"], applicationEditable: true, reservationEditable: true, polling: "none", terminal: false,
  },
  awaiting_payment: {
    allowedActions: ["view_reservation"], applicationEditable: false, reservationEditable: false, polling: "none", terminal: false,
  },
  payment_submitted: {
    allowedActions: ["view_reservation", "recheck_payment"], applicationEditable: false, reservationEditable: false, polling: "payment", terminal: false,
  },
  pending_confirmations: {
    allowedActions: ["view_reservation", "recheck_payment"], applicationEditable: false, reservationEditable: false, polling: "payment", terminal: false,
  },
  underpaid: {
    allowedActions: ["view_reservation", "submit_payment_hash", "contact_support"], applicationEditable: false, reservationEditable: false, polling: "none", terminal: false,
  },
  manual_review: {
    allowedActions: ["view_reservation", "contact_support"], applicationEditable: false, reservationEditable: false, polling: "none", terminal: false,
  },
  confirmed: {
    allowedActions: ["view_reservation"], applicationEditable: false, reservationEditable: false, polling: "incorporation", terminal: false,
  },
  awaiting_incorporation: {
    allowedActions: ["view_reservation"], applicationEditable: false, reservationEditable: false, polling: "incorporation", terminal: false,
  },
  issued: {
    allowedActions: ["view_reservation", "download_certificate", "verify_certificate"], applicationEditable: false, reservationEditable: false, polling: "none", terminal: true,
  },
  revoked: {
    allowedActions: ["view_reservation", "verify_certificate", "contact_support"], applicationEditable: false, reservationEditable: false, polling: "none", terminal: true,
  },
  cancelled: {
    allowedActions: ["resume_application"], applicationEditable: true, reservationEditable: false, polling: "none", terminal: true,
  },
  expired: {
    allowedActions: ["resume_application"], applicationEditable: true, reservationEditable: false, polling: "none", terminal: true,
  },
};

function decision(state: ApplicantJourneyState, reason: string, extraActions: ApplicantJourneyAction[] = []): ApplicantJourneyDecision {
  const presentation = APPLICANT_JOURNEY_PRESENTATION[state];
  return {
    state,
    reason,
    ...presentation,
    allowedActions: [...presentation.allowedActions, ...extraActions],
  };
}

/**
 * Reduces persisted application, KYC, order, payment and certificate facts to
 * one applicant-facing state. Browser state is deliberately not an input.
 */
export function deriveApplicantJourney(source: ApplicantJourneySource): ApplicantJourneyDecision {
  if (source.holdingStatus === "revoked") return decision("revoked", "certificate_revoked");
  if (source.holdingStatus === "issued") return decision("issued", "certificate_issued");
  if (source.holdingStatus === "issuance_error") return decision("manual_review", "certificate_issuance_inconsistent");

  const order = source.order;
  if (order?.status === "cancelled") return decision("cancelled", "reservation_cancelled");
  if (order?.status === "expired") return decision("expired", "reservation_expired");
  if (order?.status === "incorporated") return decision("awaiting_incorporation", "certificate_issuance_pending");
  if (order?.status === "confirmed") {
    return order.incorporationStatus === "pending"
      ? decision("confirmed", "payment_confirmed")
      : decision("awaiting_incorporation", "incorporation_in_progress");
  }

  const verificationStatus = order?.paymentVerificationStatus?.toLowerCase();
  if (verificationStatus === "underpaid") return decision("underpaid", "verified_amount_below_obligation");
  if (verificationStatus === "manual_review" || verificationStatus === "rejected" || verificationStatus === "failed") {
    return decision("manual_review", `payment_${verificationStatus}`);
  }
  if (verificationStatus === "pending_confirmations") return decision("pending_confirmations", "payment_waiting_for_confirmations");
  if (order?.status === "payment_detected") return decision("pending_confirmations", "payment_detected");
  if (order?.status === "payment_submitted" || order?.hasTransactionHash) return decision("payment_submitted", "payment_hash_submitted");
  if (order?.status === "awaiting_payment") {
    const paymentActions: ApplicantJourneyAction[] = order.paymentRail === "webpay_card"
      ? order.cardCheckoutStarted ? [] : ["start_card_checkout"]
      : ["submit_payment_hash"];
    const cancellationAction: ApplicantJourneyAction[] = order.cancellationEligible ? ["cancel_reservation"] : [];
    return decision("awaiting_payment", "reservation_awaiting_payment", [...paymentActions, ...cancellationAction]);
  }
  if (order) return decision("manual_review", "unmapped_reservation_state");

  const application = source.application;
  if (!application) return decision("invite_required", "no_application");
  if (application.status !== "draft") return decision("manual_review", "application_not_editable");

  const kycStatus = source.kycStatus?.toLowerCase() ?? "pending";
  if (["rejected", "declined", "failed"].includes(kycStatus)) return decision("manual_review", "kyc_review_required");
  if (application.phaseCompleted >= 4 && kycStatus !== "approved") return decision("kyc_pending", "kyc_not_approved");
  // Four persisted milestones precede the terms/reservation screen. The
  // progress endpoint deliberately accepts 1..4; phase five is the UI step
  // where the server-authoritative reservation is created.
  if (application.phaseCompleted >= 4 && kycStatus === "approved") return decision("eligible_to_reserve", "application_and_kyc_complete");
  return decision("application_in_progress", "application_incomplete");
}
