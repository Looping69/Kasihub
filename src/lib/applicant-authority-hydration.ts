import type { ApplicantAuthority } from "./applicant-portal-contract";

export type ApplicantAuthorityHydration = "initial" | "loading" | "loaded" | "refreshing" | "unavailable";

export type ApplicantAuthoritySnapshot = {
  authority: ApplicantAuthority | null;
  hydration: ApplicantAuthorityHydration;
};

/** Monotonic request generations make late responses harmless. */
export class ApplicantAuthorityFreshness {
  private latestGeneration = 0;

  begin(): number {
    this.latestGeneration += 1;
    return this.latestGeneration;
  }

  isLatest(generation: number): boolean {
    return generation === this.latestGeneration;
  }
}

export function beginAuthorityHydration(snapshot: ApplicantAuthoritySnapshot): ApplicantAuthoritySnapshot {
  return {
    authority: snapshot.authority,
    hydration: snapshot.authority?.available ? "refreshing" : "loading",
  };
}

export function completeAuthorityHydration(
  snapshot: ApplicantAuthoritySnapshot,
  authority: ApplicantAuthority,
): ApplicantAuthoritySnapshot {
  return { authority, hydration: authority.available ? "loaded" : "unavailable" };
}

export function failAuthorityHydration(snapshot: ApplicantAuthoritySnapshot): ApplicantAuthoritySnapshot {
  return snapshot.authority?.available
    ? { authority: snapshot.authority, hydration: "loaded" }
    : { authority: null, hydration: "unavailable" };
}
