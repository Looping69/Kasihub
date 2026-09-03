import { describe, expect, test } from "vitest";
import { ApplicantAuthorityFreshness, beginAuthorityHydration, completeAuthorityHydration, failAuthorityHydration } from "./applicant-authority-hydration";
import type { ApplicantAuthority } from "./applicant-portal-contract";

const authority = (state: "eligible_to_reserve" | "awaiting_payment"): ApplicantAuthority => ({
  available: true,
  journey: {
    state,
    reason: state,
    allowedActions: state === "eligible_to_reserve" ? ["create_reservation"] : ["view_reservation"],
    applicationEditable: state === "eligible_to_reserve",
    reservationEditable: false,
    polling: "none",
    terminal: false,
  },
  currentReservation: null,
});

describe("applicant authority hydration", () => {
  test("a late older response cannot replace a newer authority response", async () => {
    const freshness = new ApplicantAuthorityFreshness();
    let releaseOld!: (value: ApplicantAuthority) => void;
    const oldResponse = new Promise<ApplicantAuthority>((resolve) => { releaseOld = resolve; });
    const oldGeneration = freshness.begin();
    const newGeneration = freshness.begin();
    const newAuthority = authority("awaiting_payment");
    let current = authority("eligible_to_reserve");
    if (freshness.isLatest(newGeneration)) current = newAuthority;
    releaseOld(authority("eligible_to_reserve"));
    const staleAuthority = await oldResponse;
    if (freshness.isLatest(oldGeneration)) current = staleAuthority;
    expect(current.journey.state).toBe("awaiting_payment");
  });

  test("refreshing preserves the last authority and a failed refresh keeps it usable", () => {
    const loaded = completeAuthorityHydration({ authority: null, hydration: "loading" }, authority("awaiting_payment"));
    const refreshing = beginAuthorityHydration(loaded);
    expect(refreshing).toMatchObject({ hydration: "refreshing", authority: loaded.authority });
    expect(failAuthorityHydration(refreshing)).toEqual(loaded);
  });

  test("initial failure is explicitly unavailable", () => {
    expect(failAuthorityHydration({ authority: null, hydration: "loading" })).toEqual({ authority: null, hydration: "unavailable" });
  });
});
