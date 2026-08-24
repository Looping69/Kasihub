// Author: Klaasvaakie ( |╲ )
import { describe, expect, it } from "vitest";
import { evaluateDiditDecision } from "./didit-decision";

const approved = [{ status: "Approved" }];

describe("Didit decision evaluation", () => {
  it("approves a terminal provider approval", () => {
    expect(evaluateDiditDecision({
      status: "Approved",
      id_verifications: approved,
      liveness_checks: approved,
      face_matches: approved,
    })).toMatchObject({ nextStatus: "approved", policySatisfied: true });
  });

  it("does not re-adjudicate a reviewer-approved resubmission from stale feature nodes", () => {
    expect(evaluateDiditDecision({
      status: "Approved",
      id_verifications: approved,
      liveness_checks: approved,
      face_matches: [],
    })).toMatchObject({
      nextStatus: "approved",
      policySatisfied: true,
      checks: { identity: true, liveness: true, faceMatch: false },
    });
  });

  it("maps provider decline and review states without inventing approval", () => {
    expect(evaluateDiditDecision({ status: "Declined" }).nextStatus).toBe("rejected");
    expect(evaluateDiditDecision({ status: "In Review" }).nextStatus).toBe("pending");
  });
});
