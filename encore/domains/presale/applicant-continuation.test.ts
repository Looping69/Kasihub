// Author: Klaasvaakie ( |╲ )
import { describe, expect, test } from "vitest";
import { deriveApplicantContinuation } from "./applicant-continuation";

const draft = (phaseCompleted: number, hasResumeCredential = true) => ({
  status: "draft",
  phaseCompleted,
  hasResumeCredential,
  resumeAccessAvailable: true,
});

describe("applicant signup continuation", () => {
  test.each([
    [0, "pending", 1],
    [0, "approved", 1],
    [1, "pending", 2],
    [1, "approved", 2],
    [2, "pending", 3],
    [2, "approved", 3],
    [3, "pending", 4],
    [3, "approved", 4],
    [4, "pending", 4],
    [4, "rejected", 4],
    [4, "approved", 5],
    [5, "pending", 4],
    [5, "approved", 5],
    [6, "approved", 5],
  ])("phase %i with KYC %s resumes at authoritative step %i", (phaseCompleted, kycStatus, nextStep) => {
    expect(deriveApplicantContinuation({ application: draft(phaseCompleted), kycStatus, orderStatus: null }))
      .toEqual({ nextStep, reason: "resume" });
  });

  test.each(["expired", "cancelled"])("a %s reservation may resume through the gated reservation step", (orderStatus) => {
    expect(deriveApplicantContinuation({ application: draft(5), kycStatus: "approved", orderStatus }))
      .toEqual({ nextStep: 5, reason: "resume" });
  });

  test.each(["awaiting_payment", "payment_submitted", "payment_detected"])("an active %s reservation does not expose another signup path", (orderStatus) => {
    expect(deriveApplicantContinuation({ application: draft(5), kycStatus: "approved", orderStatus }))
      .toEqual({ nextStep: null, reason: "reservation_in_progress" });
  });

  test.each(["confirmed", "incorporated"])("a %s reservation has no unfinished signup step", (orderStatus) => {
    expect(deriveApplicantContinuation({ application: draft(5), kycStatus: "approved", orderStatus }))
      .toEqual({ nextStep: null, reason: "signup_complete" });
  });

  test.each([
    "submitted", "compliance_review", "information_required", "resubmitted", "compliance_cleared",
    "compliance_rejected", "exco_review", "exco_approved", "exco_rejected", "accepted",
    "withdrawn", "expired", "superseded",
  ])("does not reopen a non-draft %s application", (status) => {
    expect(deriveApplicantContinuation({
      application: { status, phaseCompleted: 3, hasResumeCredential: true, resumeAccessAvailable: true },
      kycStatus: "pending",
      orderStatus: null,
    })).toEqual({ nextStep: null, reason: "application_not_editable" });
  });

  test("fails closed when no application or encrypted resume credential exists", () => {
    expect(deriveApplicantContinuation({ application: null, kycStatus: "pending", orderStatus: null }))
      .toEqual({ nextStep: null, reason: "no_application" });
    expect(deriveApplicantContinuation({ application: draft(3, false), kycStatus: "pending", orderStatus: null }))
      .toEqual({ nextStep: 4, reason: "resume_credential_unavailable" });
  });

  test("does not issue a continuation when the invitation or campaign is no longer active", () => {
    expect(deriveApplicantContinuation({
      application: { ...draft(3), resumeAccessAvailable: false },
      kycStatus: "pending",
      orderStatus: null,
    })).toEqual({ nextStep: null, reason: "invitation_unavailable" });
  });

  test("an existing reservation wins over inconsistent application or KYC progress", () => {
    expect(deriveApplicantContinuation({
      application: { status: "accepted", phaseCompleted: 1, hasResumeCredential: false, resumeAccessAvailable: false },
      kycStatus: "pending",
      orderStatus: "awaiting_payment",
    }))
      .toEqual({ nextStep: null, reason: "reservation_in_progress" });
  });
});
