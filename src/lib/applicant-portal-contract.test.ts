import { describe, expect, test } from "vitest";
import {
  APPLICANT_JOURNEY_STATES,
  allowsApplicantAction,
  applicantJourneyPresentation,
  readApplicantAuthority,
  type ApplicantJourneyDecision,
  type PresaleReservationContract,
} from "./applicant-portal-contract";

const validJourney: ApplicantJourneyDecision = {
  state: "awaiting_payment",
  reason: "reservation_awaiting_payment",
  allowedActions: ["view_reservation", "submit_payment_hash", "cancel_reservation"],
  applicationEditable: false,
  reservationEditable: false,
  polling: "none",
  terminal: false,
};

const validReservation: PresaleReservationContract = {
  orderReference: "KSP-ONE",
  phaseNumber: 1,
  phaseLabel: "Phase 1",
  campaignName: "Private allocation",
  issuerName: "SOLIDUS",
  shareClass: "Class B",
  paidShares: 10,
  bonusShares: 10,
  totalAllocatedShares: 20,
  paymentMethod: "remitano_usdt",
  unitPriceUsd: "25.000000",
  totalUsd: "250.000000",
  unitPriceUsdt: "25.000000",
  totalUsdt: "250.000000",
  network: "bsc",
  paymentDeadline: "2026-09-01T12:00:00.000Z",
  termsVersion: "2026-08-16",
  status: "awaiting_payment",
  incorporationStatus: "pending",
  cancellation: { eligible: true, reason: "unpaid_no_payment_activity" },
};

describe("applicant portal authority boundary", () => {
  test("accepts a complete server authority contract", () => {
    const authority = readApplicantAuthority({ journey: validJourney, reservation: validReservation });
    expect(authority.available).toBe(true);
    expect(authority.reservation?.orderReference).toBe("KSP-ONE");
    expect(allowsApplicantAction(authority, "cancel_reservation")).toBe(true);
    expect(allowsApplicantAction(authority, "start_card_checkout")).toBe(false);
  });

  test.each([
    {},
    { journey: validJourney },
    { journey: { ...validJourney, allowedActions: ["invented_action"] }, reservation: validReservation },
    { journey: validJourney, reservation: { ...validReservation, cancellation: { eligible: true, reason: "invented_reason" } } },
  ])("fails closed for missing or malformed authority %#", (payload) => {
    const authority = readApplicantAuthority(payload);
    expect(authority.available).toBe(false);
    expect(authority.journey.state).toBe("manual_review");
    expect(authority.journey.allowedActions).toEqual(["contact_support"]);
    expect(allowsApplicantAction(authority, "cancel_reservation")).toBe(false);
  });

  test("has deliberate presentation copy for every server state", () => {
    for (const state of APPLICANT_JOURNEY_STATES) {
      const presentation = applicantJourneyPresentation({ ...validJourney, state });
      expect(presentation.label.length).toBeGreaterThan(3);
      expect(presentation.detail.length).toBeGreaterThan(10);
    }
  });
});
