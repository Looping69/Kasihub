// Runtime boundary for applicant-facing authority returned by Encore.
// The browser may present these decisions, but it must never recreate them.
// Author: Klaasvaakie ( |╲ )

export const APPLICANT_JOURNEY_STATES = [
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
] as const;

export type ApplicantJourneyState = (typeof APPLICANT_JOURNEY_STATES)[number];

export const APPLICANT_JOURNEY_ACTIONS = [
  "start_with_invitation",
  "resume_application",
  "resume_kyc",
  "refresh_kyc",
  "create_reservation",
  "view_reservation",
  "submit_payment_hash",
  "start_card_checkout",
  "recheck_payment",
  "cancel_reservation",
  "contact_support",
  "download_certificate",
  "verify_certificate",
] as const;

export type ApplicantJourneyAction = (typeof APPLICANT_JOURNEY_ACTIONS)[number];
export type ApplicantJourneyPolling = "none" | "kyc" | "payment" | "incorporation";

export type ApplicantJourneyDecision = {
  state: ApplicantJourneyState;
  reason: string;
  allowedActions: ApplicantJourneyAction[];
  applicationEditable: boolean;
  reservationEditable: boolean;
  polling: ApplicantJourneyPolling;
  terminal: boolean;
};

export type PresaleReservationContract = {
  orderReference: string;
  phaseNumber: number;
  phaseLabel: string;
  campaignName: string;
  issuerName: string;
  shareClass: string;
  paidShares: number;
  bonusShares: number;
  complimentaryShares?: number;
  totalAllocatedShares: number;
  paymentMethod: "remitano_usdt" | "webpay_card" | "complimentary_coupon";
  unitPriceUsd: string;
  totalUsd: string;
  unitPriceUsdt: string;
  totalUsdt: string;
  unitPriceZar?: string;
  totalZar?: string;
  network?: string;
  tokenContract?: string;
  receivingAddress?: string;
  requiredConfirmations?: number;
  receivedUsdt?: string;
  outstandingUsdt?: string;
  paymentDeadline: string;
  termsVersion: string;
  status: string;
  incorporationStatus: string;
  cancellation: {
    eligible: boolean;
    reason: "unpaid_no_payment_activity" | "reservation_not_awaiting_payment" | "crypto_hash_submitted" | "card_checkout_started";
  };
};

export type ApplicantAuthority = {
  available: boolean;
  journey: ApplicantJourneyDecision;
  currentReservation: PresaleReservationContract | null;
};

export type ApplicantJourneyPresentation = {
  label: string;
  detail: string;
  complete: boolean;
  attention: boolean;
};

const FAIL_CLOSED_JOURNEY: ApplicantJourneyDecision = {
  state: "manual_review",
  reason: "applicant_contract_unavailable",
  allowedActions: ["contact_support"],
  applicationEditable: false,
  reservationEditable: false,
  polling: "none",
  terminal: false,
};

const STATE_SET = new Set<string>(APPLICANT_JOURNEY_STATES);
const ACTION_SET = new Set<string>(APPLICANT_JOURNEY_ACTIONS);
const POLLING_SET = new Set<string>(["none", "kyc", "payment", "incorporation"]);
const CANCELLATION_REASON_SET = new Set<string>([
  "unpaid_no_payment_activity",
  "reservation_not_awaiting_payment",
  "crypto_hash_submitted",
  "card_checkout_started",
]);

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function string(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function optionalString(value: unknown): value is string | undefined {
  return value === undefined || string(value);
}

function optionalNumber(value: unknown): value is number | undefined {
  return value === undefined || (typeof value === "number" && Number.isFinite(value));
}

function parseJourney(value: unknown): ApplicantJourneyDecision | null {
  const input = record(value);
  if (!input || !string(input.state) || !STATE_SET.has(input.state) || !string(input.reason)) return null;
  if (!Array.isArray(input.allowedActions) || !input.allowedActions.every((action) => string(action) && ACTION_SET.has(action))) return null;
  if (typeof input.applicationEditable !== "boolean" || typeof input.reservationEditable !== "boolean") return null;
  if (!string(input.polling) || !POLLING_SET.has(input.polling) || typeof input.terminal !== "boolean") return null;
  return input as ApplicantJourneyDecision;
}

function parseReservation(value: unknown): PresaleReservationContract | null | undefined {
  if (value === null) return null;
  const input = record(value);
  const cancellation = record(input?.cancellation);
  if (!input || !cancellation) return undefined;
  const requiredStrings = [
    input.orderReference, input.phaseLabel, input.campaignName, input.issuerName, input.shareClass,
    input.unitPriceUsd, input.totalUsd, input.unitPriceUsdt, input.totalUsdt, input.paymentDeadline,
    input.termsVersion, input.status, input.incorporationStatus,
  ];
  const requiredNumbers = [input.phaseNumber, input.paidShares, input.bonusShares, input.totalAllocatedShares];
  if (!requiredStrings.every(string) || !requiredNumbers.every((number) => typeof number === "number" && Number.isFinite(number))) return undefined;
  if (input.paymentMethod !== "remitano_usdt" && input.paymentMethod !== "webpay_card" && input.paymentMethod !== "complimentary_coupon") return undefined;
  if (![input.unitPriceZar, input.totalZar, input.network, input.tokenContract, input.receivingAddress, input.receivedUsdt, input.outstandingUsdt].every(optionalString)) return undefined;
  if (!optionalNumber(input.requiredConfirmations)) return undefined;
  if (typeof cancellation.eligible !== "boolean" || !string(cancellation.reason) || !CANCELLATION_REASON_SET.has(cancellation.reason)) return undefined;
  return input as PresaleReservationContract;
}

export function readApplicantAuthority(value: unknown): ApplicantAuthority {
  const input = record(value);
  const journey = parseJourney(input?.journey);
  const reservation = parseReservation(input?.currentReservation);
  if (!journey || reservation === undefined) {
    return { available: false, journey: FAIL_CLOSED_JOURNEY, currentReservation: null };
  }
  return { available: true, journey, currentReservation: reservation };
}

export function allowsApplicantAction(authority: ApplicantAuthority | null, action: ApplicantJourneyAction): boolean {
  return Boolean(authority?.available && authority.journey.allowedActions.includes(action));
}

export function applicantJourneyPresentation(journey: ApplicantJourneyDecision): ApplicantJourneyPresentation {
  const presentation: Record<ApplicantJourneyState, ApplicantJourneyPresentation> = {
    invite_required: { label: "Private invitation required", detail: "A valid private invitation is required before an application can begin.", complete: false, attention: false },
    application_in_progress: { label: "Application in progress", detail: "Your saved application can be continued from its first unfinished step.", complete: false, attention: false },
    kyc_pending: { label: "Identity verification pending", detail: "Identity evidence must be approved before a reservation can be created.", complete: false, attention: false },
    eligible_to_reserve: { label: "Eligible to reserve", detail: "The application and identity checks are complete. Review the terms to create a reservation.", complete: false, attention: false },
    awaiting_payment: { label: "Awaiting payment", detail: "Your allocation is reserved until the displayed payment deadline.", complete: false, attention: false },
    payment_submitted: { label: "Payment submitted", detail: "The payment reference is saved and verification is in progress.", complete: false, attention: false },
    pending_confirmations: { label: "Confirmations pending", detail: "The transfer was found and is waiting for the required blockchain confirmations.", complete: false, attention: false },
    underpaid: { label: "Payment needs attention", detail: "The verified transfer is below the reserved obligation. Do not create another reservation.", complete: false, attention: true },
    manual_review: { label: "Controlled review required", detail: "This state cannot safely continue automatically. Your records remain preserved for review.", complete: false, attention: true },
    confirmed: { label: "Payment confirmed", detail: "Payment is confirmed and the allocation is waiting for controlled incorporation.", complete: true, attention: false },
    awaiting_incorporation: { label: "Incorporation in progress", detail: "The paid allocation is being incorporated into the authoritative share register.", complete: true, attention: false },
    issued: { label: "Shares issued", detail: "The allocation is recorded and its certificate is available.", complete: true, attention: false },
    revoked: { label: "Certificate revoked", detail: "The certificate is revoked. Contact support before taking further action.", complete: false, attention: true },
    cancelled: { label: "Reservation cancelled", detail: "The unpaid allocation was released. Continue only through the server-provided application route.", complete: false, attention: false },
    expired: { label: "Reservation expired", detail: "The payment window closed and the reserved allocation was released.", complete: false, attention: false },
  };
  if (journey.reason === "coupon_grant_authorized") return { ...presentation.confirmed, label: "Free shares authorized", detail: "Your coupon was redeemed. Share issuance is pending; no payment is due." };
  return presentation[journey.state];
}
