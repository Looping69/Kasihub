// Author: Klaasvaakie ( |╲ )
import type { DashboardStats } from "@/lib/types";

type CachedDashboard = {
  expiresAt: number;
  request: Promise<DashboardStats>;
};

const dashboardRequests = new Map<string, CachedDashboard>();
const DASHBOARD_DEDUPE_MS = 10_000;

export function loadDashboard(memberId: string): Promise<DashboardStats> {
  const cached = dashboardRequests.get(memberId);
  if (cached && cached.expiresAt > Date.now()) return cached.request;

  const request = fetch(`/api/dashboard?memberId=${encodeURIComponent(memberId)}`, { cache: "no-store" })
    .then(async (response) => {
      if (!response.ok) throw new Error(`Dashboard request failed with ${response.status}`);
      return response.json() as Promise<DashboardStats>;
    })
    .catch((error) => {
      dashboardRequests.delete(memberId);
      throw error;
    });

  dashboardRequests.set(memberId, { expiresAt: Date.now() + DASHBOARD_DEDUPE_MS, request });
  return request;
}

export function invalidateDashboard(memberId: string): void {
  dashboardRequests.delete(memberId);
}
