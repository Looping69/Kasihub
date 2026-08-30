// Author: Klaasvaakie ( |╲ )
import { describe, expect, test } from "vitest";
import { APPLICANT_JOURNEY_PRESENTATION, APPLICANT_JOURNEY_STATES, deriveApplicantJourney } from "./applicant-journey";

const base = {
  application: { status: "draft", phaseCompleted: 4 },
  kycStatus: "approved",
  holdingStatus: null,
};

describe("authoritative applicant journey", () => {
  test("defines presentation and permitted actions for every public state", () => {
    expect(Object.keys(APPLICANT_JOURNEY_PRESENTATION).sort()).toEqual([...APPLICANT_JOURNEY_STATES].sort());
  });

  test.each([
    [{ application: null, kycStatus: null, order: null }, "invite_required"],
    [{ application: { status: "draft", phaseCompleted: 2 }, kycStatus: "pending", order: null }, "application_in_progress"],
    [{ application: { status: "draft", phaseCompleted: 4 }, kycStatus: "pending", order: null }, "kyc_pending"],
    [{ application: { status: "draft", phaseCompleted: 4 }, kycStatus: "approved", order: null }, "eligible_to_reserve"],
  ] as const)("derives pre-reservation state from persisted progress: %s", (source, expected) => {
    expect(deriveApplicantJourney(source).state).toBe(expected);
  });

  test("locks application data and exposes only server-permitted payment actions", () => {
    const crypto = deriveApplicantJourney({
      ...base,
      order: { status: "awaiting_payment", incorporationStatus: "pending", paymentRail: "remitano_usdt", hasTransactionHash: false, cancellationEligible: true },
    });
    expect(crypto).toMatchObject({ state: "awaiting_payment", applicationEditable: false, reservationEditable: false });
    expect(crypto.allowedActions).toEqual(["view_reservation", "submit_payment_hash", "cancel_reservation"]);

    const card = deriveApplicantJourney({
      ...base,
      order: { status: "awaiting_payment", incorporationStatus: "pending", paymentRail: "webpay_card", hasTransactionHash: false, cancellationEligible: false },
    });
    expect(card.allowedActions).toEqual(["view_reservation", "start_card_checkout"]);
  });

  test.each([
    ["pending_confirmations", "pending_confirmations"],
    ["underpaid", "underpaid"],
    ["manual_review", "manual_review"],
    ["rejected", "manual_review"],
  ] as const)("maps payment verification %s to %s without treating submission as settlement", (verification, expected) => {
    expect(deriveApplicantJourney({
      ...base,
      order: {
        status: "payment_detected", incorporationStatus: "pending", paymentRail: "remitano_usdt",
        paymentVerificationStatus: verification, hasTransactionHash: true, cancellationEligible: false,
      },
    }).state).toBe(expected);
  });

  test("makes certificate evidence authoritative over stale order state", () => {
    const order = { status: "confirmed", incorporationStatus: "pending", paymentRail: "remitano_usdt" as const, hasTransactionHash: true, cancellationEligible: false };
    expect(deriveApplicantJourney({ ...base, order, holdingStatus: "issued" }).state).toBe("issued");
    expect(deriveApplicantJourney({ ...base, order, holdingStatus: "revoked" }).state).toBe("revoked");
    expect(deriveApplicantJourney({ ...base, order, holdingStatus: "issuance_error" }).state).toBe("manual_review");
  });
});
