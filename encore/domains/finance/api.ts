// Author: Klaasvaakie ( |╲ )
import { api, APIError } from "encore.dev/api";
import { commerceDb, financeDb, membershipDb, sharesDb } from "../../resources";
import { requireAdminAccess } from "../auth/access";
import {
  beginOperation,
  completeOperation,
  creditDistribution as creditWorkflowDistribution,
  failOperation,
  recordStep,
  requireIdempotencyKey,
} from "../workflows/core";
import { allocateEvenCents, allocateWeightedCents } from "./allocation";

type PoolDistributionResponse = { id: string; memberId: string; amount: number; source: string; poolType: string; status: string; payoutDate: string };

export const declareDividend = api<
  { amount: number },
  { declaration: { id: string; amount: number; totalShares: number; perShareAmount: number; status: string; declaredAt: string; paidAt: string | null }; distributedTo: number; totalShares: number; perShareAmount: number; operationId: string; status: string }
>(
  { method: "POST", path: "/admin/dividends", expose: true },
  async (req) => {
    const admin = await requireAdminAccess();
    const idempotencyKey = requireIdempotencyKey();
    if (!(req.amount > 0)) throw new Error("positive_amount_required");
    const started = await beginOperation<{
      declaration: { id: string; amount: number; totalShares: number; perShareAmount: number; status: string; declaredAt: string; paidAt: string | null };
      distributedTo: number; totalShares: number; perShareAmount: number; operationId: string; status: string;
    }>({ operationType: "dividend_distribution", actorUserId: admin.user.id, idempotencyKey, payload: req });
    if (started.operation.state === "completed" && started.operation.result) return started.operation.result;
    const operation = started.operation;
    try {
      let allocations = await financeDb.rawQueryAll<{ profile_id: string; amount: string; weight: string }>(
        "SELECT profile_id, amount::text AS amount, weight::text AS weight FROM distribution_allocations WHERE operation_id = $1 ORDER BY profile_id", operation.id);
      let declaration = await financeDb.rawQueryRow<{ id: string; amount: string; total_shares: number; per_share_amount: string; declared_at: string; paid_at: string | null }>(
        "SELECT id, amount::text AS amount, total_shares, per_share_amount::text AS per_share_amount, declared_at, paid_at FROM dividend_declarations WHERE operation_id = $1", operation.id);
      if (!declaration || allocations.length === 0) {
        const holdings = await sharesDb.rawQueryAll<{ profile_id: string; total_shares: string }>(
          `SELECT profile_id, SUM(total_shares)::text AS total_shares FROM share_certificates
           WHERE status <> 'revoked' GROUP BY profile_id ORDER BY profile_id`);
        const eligible: { profileId: string; weight: number }[] = [];
        for (const holding of holdings) {
          const subscription = await membershipDb.rawQueryRow<{ status: string }>(
            "SELECT status FROM subscriptions WHERE profile_id = $1 ORDER BY starts_at DESC LIMIT 1", holding.profile_id);
          if (subscription?.status === "active") eligible.push({ profileId: holding.profile_id, weight: Number(holding.total_shares) });
        }
        const totalShares = eligible.reduce((sum, item) => sum + item.weight, 0);
        if (totalShares <= 0) throw APIError.failedPrecondition("No active members hold eligible shares");
        const calculated = allocateWeightedCents(Math.round(req.amount * 100), eligible);
        const declarationId = crypto.randomUUID();
        const perShareAmount = req.amount / totalShares;
        const tx = await financeDb.begin();
        try {
          await tx.rawExec(`INSERT INTO dividend_declarations (id, amount, total_shares, per_share_amount, operation_id)
             VALUES ($1, $2::numeric, $3, $4::numeric, $5) ON CONFLICT (operation_id) WHERE operation_id IS NOT NULL DO NOTHING`,
            declarationId, req.amount.toFixed(2), totalShares, perShareAmount.toFixed(4), operation.id);
          for (const item of calculated) {
            await tx.rawExec(`INSERT INTO distribution_allocations (operation_id, profile_id, amount, weight)
               VALUES ($1, $2, $3::numeric, $4::numeric) ON CONFLICT (operation_id, profile_id) DO NOTHING`,
              operation.id, item.profileId, (item.cents / 100).toFixed(2), item.weight.toFixed(4));
          }
          await tx.commit();
        } catch (error) { await tx.rollback(); throw error; }
        allocations = await financeDb.rawQueryAll("SELECT profile_id, amount::text AS amount, weight::text AS weight FROM distribution_allocations WHERE operation_id = $1 ORDER BY profile_id", operation.id);
        declaration = await financeDb.rawQueryRow("SELECT id, amount::text AS amount, total_shares, per_share_amount::text AS per_share_amount, declared_at, paid_at FROM dividend_declarations WHERE operation_id = $1", operation.id);
      }
      if (!declaration) throw new Error("dividend_declaration_not_created");
      await recordStep(operation, "snapshot_allocations", "completed", { recipients: allocations.length, totalShares: declaration.total_shares });
      for (const allocation of allocations) {
        if (Number(allocation.amount) <= 0) continue;
        await creditWorkflowDistribution({ operation, profileId: allocation.profile_id, amount: allocation.amount, source: "DIVIDEND", poolType: "SHAREHOLDERS" });
      }
      await financeDb.rawExec("UPDATE dividend_declarations SET status = 'paid', paid_at = COALESCE(paid_at, now()) WHERE id = $1", declaration.id);
      await recordStep(operation, "credit_recipients", "completed", { recipients: allocations.length });
      const paidAt = new Date().toISOString();
      const result = {
        declaration: { id: declaration.id, amount: Number(declaration.amount), totalShares: declaration.total_shares, perShareAmount: Number(declaration.per_share_amount), status: "PAID", declaredAt: declaration.declared_at, paidAt },
        distributedTo: allocations.filter((item) => Number(item.amount) > 0).length,
        totalShares: declaration.total_shares,
        perShareAmount: Number(declaration.per_share_amount),
        operationId: operation.id,
        status: "completed",
      };
      return completeOperation(operation, result);
    } catch (error) { return failOperation(operation, error); }
  },
);

export const adminDividends = api<void, { dividends: { id: string; amount: number; totalShares: number; perShareAmount: number; status: string; declaredAt: string; paidAt: string | null }[] }>(
  { method: "GET", path: "/admin/dividends", expose: true },
  async () => {
    await requireAdminAccess();
    const rows = await financeDb.rawQueryAll<{ id: string; amount: string; total_shares: number; per_share_amount: string; status: string; declared_at: string; paid_at: string | null }>(
      "SELECT id, amount::text AS amount, total_shares, per_share_amount::text AS per_share_amount, status, declared_at, paid_at FROM dividend_declarations ORDER BY declared_at DESC",
    );
    return { dividends: rows.map((row) => ({ id: row.id, amount: Number(row.amount), totalShares: row.total_shares, perShareAmount: Number(row.per_share_amount), status: row.status.toUpperCase(), declaredAt: row.declared_at, paidAt: row.paid_at })) };
  },
);

export const poolOverview = api<{ limit?: number }, {
  distributions: PoolDistributionResponse[];
  totals: { totalIncoming: number; mallPoolIncoming: number; marketplacePoolIncoming: number; totalPaidOut: number; balance: number; distributionCount: number };
  eligibleMembers: number;
}>(
  { method: "GET", path: "/admin/pool", expose: true },
  async (req) => {
    await requireAdminAccess();
    const rows = await financeDb.rawQueryAll<{ id: string; profile_id: string; amount: string; source: string; pool_type: string; status: string; payout_date: string }>(
      `SELECT id, profile_id, amount::text AS amount, source, pool_type, status, payout_date
       FROM pool_distributions ORDER BY payout_date DESC LIMIT $1`, Math.min(Math.max(req.limit ?? 100, 1), 500),
    );
    const incoming = await commerceDb.rawQueryRow<{ mall: string; marketplace: string }>(
      `SELECT
         COALESCE((SELECT SUM(kasi_pool) FROM mall_transactions), 0)::text AS mall,
         COALESCE((SELECT SUM(commission) FROM marketplace_orders), 0)::text AS marketplace`,
    );
    const eligible = await membershipDb.rawQueryRow<{ count: string }>("SELECT COUNT(DISTINCT profile_id)::text AS count FROM subscriptions WHERE status = 'active'");
    const distributions = rows.map(poolDistributionResponse);
    const mallPoolIncoming = Number(incoming?.mall ?? 0);
    const marketplacePoolIncoming = Number(incoming?.marketplace ?? 0);
    const totalPaidOut = distributions.filter((distribution) => distribution.status === "PAID").reduce((sum, distribution) => sum + distribution.amount, 0);
    const totalIncoming = mallPoolIncoming + marketplacePoolIncoming;
    return { distributions, totals: { totalIncoming, mallPoolIncoming, marketplacePoolIncoming, totalPaidOut, balance: totalIncoming - totalPaidOut, distributionCount: distributions.length }, eligibleMembers: Number(eligible?.count ?? 0) };
  },
);

export const distributePool = api<
  { totalAmount: number; source?: string },
  { distributed: number; perMember: number; totalDistributed: number; operationId: string; status: string }
>(
  { method: "POST", path: "/admin/pool/distributions", expose: true },
  async (req) => {
    const admin = await requireAdminAccess();
    const idempotencyKey = requireIdempotencyKey();
    if (!(req.totalAmount > 0)) throw new Error("positive_amount_required");
    const started = await beginOperation<{
      distributed: number; perMember: number; totalDistributed: number; operationId: string; status: string;
    }>({ operationType: "pool_distribution", actorUserId: admin.user.id, idempotencyKey, payload: req });
    if (started.operation.state === "completed" && started.operation.result) return started.operation.result;
    const operation = started.operation;
    try {
      let allocations = await financeDb.rawQueryAll<{ profile_id: string; amount: string }>(
        "SELECT profile_id, amount::text AS amount FROM distribution_allocations WHERE operation_id = $1 ORDER BY profile_id", operation.id);
      if (allocations.length === 0) {
        const profiles = await membershipDb.rawQueryAll<{ profile_id: string }>(
          "SELECT DISTINCT profile_id FROM subscriptions WHERE status = 'active' ORDER BY profile_id");
        if (profiles.length === 0) throw APIError.failedPrecondition("No active members are eligible for distribution");
        const calculated = allocateEvenCents(Math.round(req.totalAmount * 100), profiles.map((item) => item.profile_id));
        const tx = await financeDb.begin();
        try {
          for (const item of calculated) {
            await tx.rawExec(`INSERT INTO distribution_allocations (operation_id, profile_id, amount)
               VALUES ($1, $2, $3::numeric) ON CONFLICT (operation_id, profile_id) DO NOTHING`,
              operation.id, item.profileId, (item.cents / 100).toFixed(2));
          }
          await tx.commit();
        } catch (error) { await tx.rollback(); throw error; }
        allocations = await financeDb.rawQueryAll("SELECT profile_id, amount::text AS amount FROM distribution_allocations WHERE operation_id = $1 ORDER BY profile_id", operation.id);
      }
      await recordStep(operation, "snapshot_allocations", "completed", { recipients: allocations.length, totalAmount: req.totalAmount });
      for (const allocation of allocations) {
        if (Number(allocation.amount) <= 0) continue;
        await creditWorkflowDistribution({ operation, profileId: allocation.profile_id, amount: allocation.amount, source: req.source ?? "MANUAL", poolType: "SHAREHOLDERS" });
      }
      await recordStep(operation, "credit_recipients", "completed", { recipients: allocations.length });
      const totalDistributed = Number(allocations.reduce((sum, item) => sum + Number(item.amount), 0).toFixed(2));
      return completeOperation(operation, {
        distributed: allocations.filter((item) => Number(item.amount) > 0).length,
        perMember: Number((req.totalAmount / allocations.length).toFixed(2)),
        totalDistributed,
        operationId: operation.id,
        status: "completed",
      });
    } catch (error) { return failOperation(operation, error); }
  },
);


function poolDistributionResponse(row: { id: string; profile_id: string; amount: string; source: string; pool_type: string; status: string; payout_date: string }): PoolDistributionResponse {
  return { id: row.id, memberId: row.profile_id, amount: Number(row.amount), source: row.source, poolType: row.pool_type, status: row.status.toUpperCase(), payoutDate: row.payout_date };
}


