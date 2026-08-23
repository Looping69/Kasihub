// Author: Klaasvaakie ( |╲ )
import { api } from "encore.dev/api";
import { financeDb } from "../../resources";
import { requireEcosystemProfileAccess } from "../auth/access";

type MemberDistribution = {
  id: string;
  amount: number;
  source: string;
  poolType: string;
  status: string;
  payoutDate: string;
};

type PoolTotals = {
  total: number;
  today: number;
  distributions: MemberDistribution[];
};

export const memberFinanceSummary = api<
  { profileId: string },
  {
    distributions: MemberDistribution[];
    pools: Record<string, PoolTotals>;
  }
>(
  { method: "GET", path: "/finance/me/:profileId/summary", expose: true },
  async ({ profileId }) => {
    await requireEcosystemProfileAccess(profileId);

    const rows = await financeDb.rawQueryAll<{
      id: string;
      amount: string;
      source: string;
      pool_type: string;
      status: string;
      payout_date: string;
    }>(
      `SELECT id, amount::text AS amount, source, pool_type, status, payout_date
       FROM pool_distributions
       WHERE profile_id = $1
       ORDER BY payout_date DESC
       LIMIT 500`,
      profileId,
    );

    const today = johannesburgDateKey(new Date());
    const distributions = rows.map((row) => ({
      id: row.id,
      amount: Number(row.amount),
      source: row.source,
      poolType: row.pool_type.toUpperCase(),
      status: row.status.toUpperCase(),
      payoutDate: row.payout_date,
    }));

    const pools: Record<string, PoolTotals> = {};
    for (const distribution of distributions) {
      const key = distribution.poolType;
      const pool = pools[key] ?? { total: 0, today: 0, distributions: [] };
      if (distribution.status === "PAID") {
        pool.total += distribution.amount;
        if (johannesburgDateKey(new Date(distribution.payoutDate)) === today) pool.today += distribution.amount;
      }
      pool.distributions.push(distribution);
      pools[key] = pool;
    }

    return { distributions, pools };
  },
);

function johannesburgDateKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Johannesburg",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
