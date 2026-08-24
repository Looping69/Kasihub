// Author: Klaasvaakie ( |╲ )

export type DiditDecisionItem = { status?: unknown };

export type DiditDecisionPayload = {
  session_id?: unknown;
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
  const policySatisfied = providerStatus === "Approved"
    && checks.identity
    && checks.liveness
    && checks.faceMatch;

  return {
    providerStatus,
    checks,
    policySatisfied,
    nextStatus: policySatisfied ? "approved" as const
      : providerStatus === "Declined" ? "rejected" as const
        : "pending" as const,
  };
}
