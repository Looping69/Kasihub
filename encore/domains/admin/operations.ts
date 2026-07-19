// Author: Klaasvaakie ( |╲ )
import { api, APIError } from "encore.dev/api";
import { CronJob } from "encore.dev/cron";
import * as log from "encore.dev/log";
import { auditDb, financeDb, identityDb, membershipDb, networkDb, sharesDb } from "../../infrastructure/resources";
import { requireAdminAccess } from "../auth/access";

type OperationRow = {
  id: string;
  operation_type: string;
  profile_id: string | null;
  state: string;
  retry_count: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

type OperationResponse = {
  id: string;
  type: string;
  profileId: string | null;
  state: string;
  retryCount: number;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

export const listOperations = api<
  { state?: string; limit?: number },
  { operations: OperationResponse[] }
>({ method: "GET", path: "/admin/operations", expose: true }, async (req) => {
  await requireAdminAccess();
  const rows = await financeDb.rawQueryAll<OperationRow>(`SELECT id, operation_type, profile_id, state,
      retry_count, last_error, created_at, updated_at, completed_at FROM financial_operations
      WHERE ($1 = '' OR state = $1) ORDER BY created_at DESC LIMIT $2`,
    req.state ?? "", Math.min(Math.max(req.limit ?? 100, 1), 500));
  return { operations: rows.map(operationResponse) };
});

export const operationDetails = api<
  { id: string },
  { operation: OperationResponse; steps: { name: string; state: string; attempts: number; details: Record<string, unknown>; lastError: string | null; updatedAt: string }[] }
>({ method: "GET", path: "/admin/operations/:id", expose: true }, async (req) => {
  await requireAdminAccess();
  const row = await financeDb.rawQueryRow<OperationRow>(`SELECT id, operation_type, profile_id, state,
      retry_count, last_error, created_at, updated_at, completed_at FROM financial_operations WHERE id = $1`, req.id);
  if (!row) throw APIError.notFound("Financial operation not found");
  const steps = await financeDb.rawQueryAll<{ step_name: string; state: string; attempt_count: number; details: Record<string, unknown>; last_error: string | null; updated_at: string }>(
    "SELECT step_name, state, attempt_count, details, last_error, updated_at FROM financial_operation_steps WHERE operation_id = $1 ORDER BY started_at, step_name", req.id);
  return { operation: operationResponse(row), steps: steps.map((step) => ({ name: step.step_name, state: step.state, attempts: step.attempt_count, details: step.details, lastError: step.last_error, updatedAt: step.updated_at })) };
});

export const retryOperation = api<{ id: string }, { operationId: string; status: string; nextAction: string }>(
  { method: "POST", path: "/admin/operations/:id/retry", expose: true },
  async (req) => {
    const admin = await requireAdminAccess();
    const row = await financeDb.rawQueryRow<{ state: string }>("SELECT state FROM financial_operations WHERE id = $1", req.id);
    if (!row) throw APIError.notFound("Financial operation not found");
    if (row.state === "completed") throw APIError.failedPrecondition("Completed operations cannot be retried");
    await financeDb.rawExec(`UPDATE financial_operations SET state = 'processing', retry_count = retry_count + 1,
       last_error = NULL, updated_at = now() WHERE id = $1`, req.id);
    await financeDb.rawExec(`UPDATE financial_operation_steps SET state = 'pending', updated_at = now()
       WHERE operation_id = $1 AND state = 'failed'`, req.id);
    await auditDb.rawExec(`INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, after)
       VALUES ($1, 'operations.retry', 'financial_operations', $2, $3::jsonb)`,
      admin.user.id, req.id, JSON.stringify({ previousState: row.state }));
    log.info("financial operation queued for retry", { operationId: req.id, actorUserId: admin.user.id, previousState: row.state });
    return { operationId: req.id, status: "processing", nextAction: "replay_original_operation" };
  },
);

export const runReconciliation = api<void, { runId: string; checked: number; findings: number; status: string }>(
  { method: "POST", path: "/admin/reconciliation/runs", expose: true },
  async () => {
    const admin = await requireAdminAccess();
    const result = await executeReconciliation("manual");
    await auditDb.rawExec(`INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, after)
       VALUES ($1, 'reconciliation.run', 'reconciliation_runs', $2, $3::jsonb)`,
      admin.user.id, result.runId, JSON.stringify({ checked: result.checked, findings: result.findings }));
    return result;
  },
);

export const listReconciliationFindings = api<
  { state?: string; limit?: number },
  { findings: { id: string; runId: string; type: string; severity: string; entityType: string; entityId: string; expected: unknown; actual: unknown; state: string; createdAt: string }[] }
>({ method: "GET", path: "/admin/reconciliation/findings", expose: true }, async (req) => {
  await requireAdminAccess();
  const rows = await financeDb.rawQueryAll<{ id: string; run_id: string; finding_type: string; severity: string; entity_type: string; entity_id: string; expected: unknown; actual: unknown; state: string; created_at: string }>(
    `SELECT id, run_id, finding_type, severity, entity_type, entity_id, expected, actual, state, created_at
     FROM reconciliation_findings WHERE ($1 = '' OR state = $1) ORDER BY created_at DESC LIMIT $2`,
    req.state ?? "", Math.min(Math.max(req.limit ?? 100, 1), 500));
  return { findings: rows.map((row) => ({ id: row.id, runId: row.run_id, type: row.finding_type, severity: row.severity, entityType: row.entity_type, entityId: row.entity_id, expected: row.expected, actual: row.actual, state: row.state, createdAt: row.created_at })) };
});

export const resolveReconciliationFinding = api<{ id: string; resolution: string; state?: "resolved" | "ignored" }, { ok: true }>(
  { method: "POST", path: "/admin/reconciliation/findings/:id/resolve", expose: true },
  async (req) => {
    const admin = await requireAdminAccess();
    if (!req.resolution?.trim()) throw APIError.invalidArgument("Resolution is required");
    const updated = await financeDb.rawQueryRow<{ id: string }>(`UPDATE reconciliation_findings
      SET state = $2, resolution = $3, resolved_at = now() WHERE id = $1 AND state = 'open' RETURNING id`,
      req.id, req.state ?? "resolved", req.resolution.trim());
    if (!updated) throw APIError.notFound("Open reconciliation finding not found");
    await auditDb.rawExec(`INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, after)
       VALUES ($1, 'reconciliation.resolve', 'reconciliation_findings', $2, $3::jsonb)`,
      admin.user.id, req.id, JSON.stringify({ state: req.state ?? "resolved", resolution: req.resolution.trim() }));
    return { ok: true };
  },
);

export const scheduledReconciliation = api<void, { runId: string; checked: number; findings: number; status: string }>(
  { method: "POST", path: "/internal/reconciliation/run", expose: false },
  async () => executeReconciliation("scheduled"),
);

const reconciliationJob = new CronJob("financial-reconciliation", {
  title: "Reconcile financial workflows and projections",
  every: "1h",
  endpoint: scheduledReconciliation,
});
void reconciliationJob;

async function executeReconciliation(scope: string) {
  const runId = crypto.randomUUID();
  await financeDb.rawExec("INSERT INTO reconciliation_runs (id, scope) VALUES ($1, $2)", runId, scope);
  let checked = 0;
  let findings = 0;
  try {
    const stuck = await financeDb.rawQueryAll<{ id: string; operation_type: string; state: string; updated_at: string }>(
      `SELECT id, operation_type, state, updated_at FROM financial_operations
       WHERE state IN ('pending','processing','compensating') AND updated_at < now() - interval '10 minutes' LIMIT 500`);
    checked += stuck.length;
    for (const row of stuck) {
      await addFinding(runId, "stuck_operation", "critical", "financial_operation", row.id,
        { state: "completed_or_failed" }, { state: row.state, operationType: row.operation_type, updatedAt: row.updated_at });
      findings++;
    }

    const staleHolds = await financeDb.rawQueryAll<{ id: string; operation_id: string; profile_id: string; amount: string; currency: string; created_at: string }>(
      `SELECT id, operation_id, profile_id, amount::text AS amount, currency, created_at FROM wallet_holds
       WHERE state = 'held' AND created_at < now() - interval '10 minutes' LIMIT 500`);
    checked += staleHolds.length;
    for (const row of staleHolds) {
      await addFinding(runId, "stale_wallet_hold", "critical", "wallet_hold", row.id,
        { state: "captured_or_released" }, { operationId: row.operation_id, profileId: row.profile_id, amount: row.amount, currency: row.currency, createdAt: row.created_at });
      findings++;
    }

    const imbalanced = await financeDb.rawQueryAll<{ id: string; debits: string; credits: string }>(
      `SELECT lt.id,
        COALESCE(SUM(CASE WHEN le.direction = 'debit' THEN le.amount ELSE 0 END),0)::text AS debits,
        COALESCE(SUM(CASE WHEN le.direction = 'credit' THEN le.amount ELSE 0 END),0)::text AS credits
       FROM ledger_transactions lt LEFT JOIN ledger_entries le ON le.transaction_id = lt.id
       GROUP BY lt.id HAVING COALESCE(SUM(CASE WHEN le.direction = 'debit' THEN le.amount ELSE 0 END),0)
         <> COALESCE(SUM(CASE WHEN le.direction = 'credit' THEN le.amount ELSE 0 END),0) LIMIT 500`);
    checked += imbalanced.length;
    for (const row of imbalanced) {
      await addFinding(runId, "unbalanced_ledger", "critical", "ledger_transaction", row.id,
        { debitsEqualCredits: true }, { debits: row.debits, credits: row.credits });
      findings++;
    }

    const wallets = await financeDb.rawQueryAll<{ profile_id: string; currency: string; available_balance: string }>(
      "SELECT profile_id, currency, available_balance::text AS available_balance FROM wallet_balances ORDER BY profile_id LIMIT 1000");
    for (const wallet of wallets) {
      checked++;
      const projection = await networkDb.rawQueryRow<{ currency: string; cached_balance: string }>(
        "SELECT currency, cached_balance::text AS cached_balance FROM wallets WHERE profile_id = $1", wallet.profile_id);
      if (!projection || projection.currency !== wallet.currency || Number(projection.cached_balance) !== Number(wallet.available_balance)) {
        await addFinding(runId, "wallet_projection_mismatch", "warning", "wallet", wallet.profile_id,
          { currency: wallet.currency, balance: wallet.available_balance }, projection ?? null);
        findings++;
      }
    }

    const brokenShares = await sharesDb.rawQueryAll<{ id: string; status: string; certificate_id: string | null }>(
      "SELECT id, status, certificate_id FROM share_purchases WHERE status = 'paid' AND certificate_id IS NULL LIMIT 500");
    checked += brokenShares.length;
    for (const row of brokenShares) {
      await addFinding(runId, "paid_share_without_certificate", "critical", "share_purchase", row.id,
        { certificateId: "present" }, { certificateId: row.certificate_id, status: row.status });
      findings++;
    }

    const inventoryMismatches = await sharesDb.rawQueryAll<{
      id: string; phase_number: number; total_quantity: number; quantity_available: number; allocated_quantity: string;
    }>(`SELECT phase.id, phase.phase_number, phase.total_quantity, phase.quantity_available,
          COALESCE(SUM(CASE WHEN purchase.status IN ('reserved','paid')
            THEN purchase.quantity + purchase.bonus_quantity ELSE 0 END), 0)::text AS allocated_quantity
        FROM share_phases phase
        LEFT JOIN share_purchases purchase ON purchase.phase_id = phase.id
        GROUP BY phase.id, phase.phase_number, phase.total_quantity, phase.quantity_available
        HAVING phase.quantity_available <> phase.total_quantity - COALESCE(SUM(CASE
          WHEN purchase.status IN ('reserved','paid') THEN purchase.quantity + purchase.bonus_quantity ELSE 0 END), 0)
        LIMIT 500`);
    checked += inventoryMismatches.length;
    for (const row of inventoryMismatches) {
      await addFinding(runId, "share_inventory_mismatch", "critical", "share_phase", row.id,
        { available: row.total_quantity - Number(row.allocated_quantity) },
        { phaseNumber: row.phase_number, available: row.quantity_available, allocated: row.allocated_quantity, total: row.total_quantity });
      findings++;
    }

    const certificateMismatches = await sharesDb.rawQueryAll<{
      purchase_id: string; certificate_id: string; expected_shares: number; actual_shares: number;
    }>(`SELECT purchase.id AS purchase_id, certificate.id AS certificate_id,
          purchase.quantity + purchase.bonus_quantity AS expected_shares,
          certificate.total_shares AS actual_shares
        FROM share_purchases purchase
        JOIN share_certificates certificate ON certificate.id = purchase.certificate_id
        WHERE purchase.status = 'paid'
          AND certificate.total_shares <> purchase.quantity + purchase.bonus_quantity
        LIMIT 500`);
    checked += certificateMismatches.length;
    for (const row of certificateMismatches) {
      await addFinding(runId, "share_certificate_quantity_mismatch", "critical", "share_purchase", row.purchase_id,
        { certificateId: row.certificate_id, totalShares: row.expected_shares }, { totalShares: row.actual_shares });
      findings++;
    }

    const inconsistentSubscriptions = await membershipDb.rawQueryAll<{ id: string; profile_id: string }>(
      `SELECT s.id, s.profile_id FROM subscriptions s
       JOIN payments p ON p.subscription_id = s.id WHERE p.status = 'paid' AND s.status <> 'active' LIMIT 500`);
    checked += inconsistentSubscriptions.length;
    for (const row of inconsistentSubscriptions) {
      await addFinding(runId, "paid_inactive_subscription", "critical", "subscription", row.id,
        { status: "active" }, { profileId: row.profile_id });
      findings++;
    }

    const payoutWithoutLedger = await financeDb.rawQueryAll<{ id: string; operation_id: string | null }>(
      `SELECT payout.id, payout.operation_id FROM pool_distributions payout
       LEFT JOIN ledger_transactions transaction
         ON transaction.reference_type = 'pool_distribution' AND transaction.reference_id = payout.id
       WHERE payout.status = 'paid' AND transaction.id IS NULL LIMIT 500`);
    checked += payoutWithoutLedger.length;
    for (const row of payoutWithoutLedger) {
      await addFinding(runId, "paid_distribution_without_ledger", "critical", "pool_distribution", row.id,
        { ledgerTransaction: "present" }, { operationId: row.operation_id, ledgerTransaction: null });
      findings++;
    }

    const distributionTotalMismatches = await financeDb.rawQueryAll<{
      operation_id: string; declared_amount: string; allocated_amount: string;
    }>(`SELECT declaration.operation_id,
          declaration.amount::text AS declared_amount,
          COALESCE(SUM(allocation.amount), 0)::text AS allocated_amount
       FROM dividend_declarations declaration
       LEFT JOIN distribution_allocations allocation ON allocation.operation_id = declaration.operation_id
       WHERE declaration.operation_id IS NOT NULL
       GROUP BY declaration.operation_id, declaration.amount
       HAVING declaration.amount <> COALESCE(SUM(allocation.amount), 0)
       LIMIT 500`);
    checked += distributionTotalMismatches.length;
    for (const row of distributionTotalMismatches) {
      await addFinding(runId, "dividend_allocation_total_mismatch", "critical", "financial_operation", row.operation_id,
        { total: row.declared_amount }, { total: row.allocated_amount });
      findings++;
    }

    const stalledRegistrations = await identityDb.rawQueryAll<{ id: string; state: string; updated_at: string }>(
      `SELECT id, state, updated_at FROM registration_workflows
       WHERE state IN ('pending','identity_created','membership_pending','kyc_pending','failed')
         AND updated_at < now() - interval '30 minutes' LIMIT 500`);
    checked += stalledRegistrations.length;
    for (const row of stalledRegistrations) {
      await addFinding(runId, "stalled_registration", row.state === "failed" ? "critical" : "warning",
        "registration_workflow", row.id, { state: "completed" }, { state: row.state, updatedAt: row.updated_at });
      findings++;
    }

    await financeDb.rawExec(`UPDATE reconciliation_runs SET state = 'completed', checked_count = $2,
       finding_count = $3, completed_at = now() WHERE id = $1`, runId, checked, findings);
    log.info("financial reconciliation completed", { runId, scope, checked, findings });
    return { runId, checked, findings, status: "completed" };
  } catch (error) {
    await financeDb.rawExec(`UPDATE reconciliation_runs SET state = 'failed', checked_count = $2,
       finding_count = $3, last_error = $4, completed_at = now() WHERE id = $1`, runId, checked, findings,
      (error instanceof Error ? error.message : String(error)).slice(0, 1000));
    log.error(error, "financial reconciliation failed", { runId, scope, checked, findings });
    throw error;
  }
}

async function addFinding(runId: string, type: string, severity: string, entityType: string, entityId: string, expected: unknown, actual: unknown) {
  await financeDb.rawExec(`INSERT INTO reconciliation_findings
    (run_id, finding_type, severity, entity_type, entity_id, expected, actual)
    VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb)
    ON CONFLICT (run_id, finding_type, entity_type, entity_id) DO NOTHING`,
    runId, type, severity, entityType, entityId, JSON.stringify(expected), JSON.stringify(actual));
}

function operationResponse(row: OperationRow): OperationResponse {
  return { id: row.id, type: row.operation_type, profileId: row.profile_id, state: row.state, retryCount: row.retry_count, lastError: row.last_error, createdAt: row.created_at, updatedAt: row.updated_at, completedAt: row.completed_at };
}
