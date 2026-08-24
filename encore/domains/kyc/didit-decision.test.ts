// Author: Klaasvaakie ( |╲ )
import { describe, expect, it } from "vitest";
import { evaluateDiditDecision } from "./didit-decision";

const approved = [{ status: "Approved" }];

describe("Didit decision evaluation", () => {
  it("approves only when the overall decision and every required check are approved", () => {
    expect(evaluateDiditDecision({
      status: "Approved",
      id_verifications: approved,
      liveness_checks: approved,
      face_matches: approved,
    })).toMatchObject({ nextStatus: "approved", policySatisfied: true });
  });

  it("does not trust an overall approval that omits required evidence", () => {
    expect(evaluateDiditDecision({
      status: "Approved",
      id_verifications: approved,
      liveness_checks: approved,
      face_matches: [],
    })).toMatchObject({ nextStatus: "pending", policySatisfied: false });
  });

  it("maps provider decline and review states without inventing approval", () => {
    expect(evaluateDiditDecision({ status: "Declined" }).nextStatus).toBe("rejected");
    expect(evaluateDiditDecision({ status: "In Review" }).nextStatus).toBe("pending");
  });
});
