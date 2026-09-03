import { describe, expect, test } from "vitest";
import { applicantAuthorityView } from "./applicant-authority-view";
import { readApplicantAuthority, type ApplicantJourneyDecision, type PresaleReservationContract } from "./applicant-portal-contract";

const reservation: PresaleReservationContract = {
  orderReference: "KSP-ACTIVE", phaseNumber: 7, phaseLabel: "Controlled allocation", campaignName: "Server campaign",
  issuerName: "Server issuer", shareClass: "Class B", paidShares: 2, bonusShares: 2, totalAllocatedShares: 4,
  paymentMethod: "webpay_card", unitPriceUsd: "31.125000", totalUsd: "62.250000", unitPriceUsdt: "30.990000",
  totalUsdt: "61.980000", unitPriceZar: "612.34", totalZar: "1224.68", paymentDeadline: "2026-09-04T12:00:00.000Z",
  termsVersion: "server-terms-v9", status: "awaiting_payment", incorporationStatus: "pending",
  cancellation: { eligible: true, reason: "unpaid_no_payment_activity" },
};

const journey = (overrides: Partial<ApplicantJourneyDecision> = {}): ApplicantJourneyDecision => ({
  state: "awaiting_payment", reason: "reservation_awaiting_payment", allowedActions: ["view_reservation", "start_card_checkout"],
  applicationEditable: false, reservationEditable: false, polling: "none", terminal: false, ...overrides,
});

describe("applicant authority presentation gates", () => {
  test.each([
    ["editable application", journey({ allowedActions: ["resume_application", "create_reservation"], applicationEditable: true, reservationEditable: true })],
    ["draft continuation", journey({ state: "application_in_progress", allowedActions: ["resume_application"], applicationEditable: true })],
    ["late KYC hydration", journey({ state: "kyc_pending", allowedActions: ["resume_kyc", "refresh_kyc"], applicationEditable: true, polling: "kyc" })],
  ])("an active reservation outranks %s state in the same authority snapshot", (_label, staleJourney) => {
    expect(applicantAuthorityView({ available: true, journey: staleJourney, currentReservation: reservation })).toEqual({
      showReservation: true, canCreateReservation: false, transactionalActionsReady: true,
    });
  });

  test("never exposes reservation creation while a non-terminal reservation exists", () => {
    expect(applicantAuthorityView({ available: true, journey: journey({ allowedActions: ["create_reservation"] }), currentReservation: reservation }).canCreateReservation).toBe(false);
  });

  test.each(["cancelled", "expired"] as const)("exposes a new path after %s only when the backend explicitly permits it", (state) => {
    const denied = { available: true, journey: journey({ state, allowedActions: ["resume_application"], terminal: true }), currentReservation: null };
    const allowed = { available: true, journey: journey({ state, allowedActions: ["create_reservation"], terminal: true }), currentReservation: null };
    expect(applicantAuthorityView(denied).canCreateReservation).toBe(false);
    expect(applicantAuthorityView(allowed).canCreateReservation).toBe(true);
  });

  test("renders no transactional CTA while authority is absent or malformed", () => {
    expect(applicantAuthorityView(null).transactionalActionsReady).toBe(false);
    expect(applicantAuthorityView(readApplicantAuthority({ journey: {}, reservation: {} }))).toEqual({
      showReservation: false, canCreateReservation: false, transactionalActionsReady: false,
    });
  });

  test("keeps financial presentation values exactly as returned by reservation authority", () => {
    expect(readApplicantAuthority({ journey: journey(), currentReservation: reservation }).currentReservation).toMatchObject({
      phaseLabel: "Controlled allocation", unitPriceUsd: "31.125000", totalUsdt: "61.980000", unitPriceZar: "612.34", totalZar: "1224.68",
    });
  });
});
