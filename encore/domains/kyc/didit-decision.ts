// Author: Klaasvaakie ( |╲ )

export type DiditDecisionItem = { status?: unknown };

export type DiditDecisionPayload = {
  session_id?: unknown;
  session_url?: unknown;
  workflow_id?: unknown;
  vendor_data?: unknown;
  status?: unknown;
  id_verifications?: DiditDecisionItem[];
  liveness_checks?: DiditDecisionItem[];
  face_matches?: DiditDecisionItem[];
};

export function allDiditChecksApproved(items: DiditDecisionItem[] | undefined): boolean {
  return Array.isArray(items) && items.length > 0 && items.every((item) => item.status === "Approved");
}

export function evaluateDiditDecision(payload: DiditDecisionPayload) {
  const providerStatus = typeof payload.status === "string" ? payload.status : "Unknown";
  const checks = {
    identity: allDiditChecksApproved(payload.id_verifications),
    liveness: allDiditChecksApproved(payload.liveness_checks),
    faceMatch: allDiditChecksApproved(payload.face_matches),
  };
  // Didit's terminal Approved status is the provider's signed workflow
  // decision. Per-feature arrays are retained as diagnostic evidence, but
  // must not re-adjudicate a reviewer-approved resubmission using stale or
  // omitted feature nodes.
  const policySatisfied = providerStatus === "Approved";

  return {
    providerStatus,
    checks,
    policySatisfied,
    nextStatus: policySatisfied ? "approved" as const
      : providerStatus === "Declined" ? "rejected" as const
        : "pending" as const,
  };
}
