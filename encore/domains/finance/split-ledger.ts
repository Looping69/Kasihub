// Author: Klaasvaakie ( |╲ )
import { financeDb } from "../../resources";
import type { ResolvedAllocation } from "./split-policy";

export type ApplyAllocationRunInput = {
  settlementRef: string;
  policyKey: string;
  policyVersion: number;
  sourceAmountMinor: bigint;
  currency: string;
  allocations: readonly ResolvedAllocation[];
  metadata?: Record<string, unknown>;
};

export type AppliedAllocationRun = {
  runId: string;
  settlementRef: string;
  policyKey: string;
  policyVersion: number;
  sourceAmountMinor: bigint;
  currency: string;
  allocationCount: number;
  idempotentReplay: boolean;
};

type ExistingRunRow = {
  id: string;
  settlement_ref: string;
  policy_key: string;
  version: number;
  source_amount_minor: string;
  currency: string;
  allocation_count: string;
};

function validateApplyInput(input: ApplyAllocationRunInput): void {
  if (!input.settlementRef.trim()) throw new Error("settlement_ref_required");
  if (!input.policyKey.trim()) throw new Error("policy_key_required");
  if (!Number.isSafeInteger(input.policyVersion) || input.policyVersion <= 0) throw new Error("invalid_policy_version");
  if (input.sourceAmountMinor < 0n) throw new Error("invalid_source_amount_minor");
  if (!input.currency.trim()) throw new Error("currency_required");
  if (input.allocations.length === 0) throw new Error("allocations_required");

  const seenRuleCodes = new Set<string>();
  let total = 0n;
  for (const allocation of input.allocations) {
    if (!allocation.ruleCode.trim() || seenRuleCodes.has(allocation.ruleCode)) throw new Error("invalid_allocation_rule_code");
    if (!allocation.sourceRecipientType.trim() || !allocation.recipientType.trim() || !allocation.recipientRef.trim()) {
      throw new Error("resolved_recipient_required");
    }
    if (allocation.amountMinor < 0n || allocation.remainderMinor < 0n) throw new Error("invalid_allocation_amount");
    if (!Number.isSafeInteger(allocation.basisPoints) || allocation.basisPoints < 0 || allocation.basisPoints > 10_000) {
      throw new Error("invalid_allocation_basis_points");
    }
    seenRuleCodes.add(allocation.ruleCode);
    total += allocation.amountMinor;
  }
  if (total !== input.sourceAmountMinor) throw new Error("allocation_run_not_conserved");
}

function mapExisting(row: ExistingRunRow, idempotentReplay: boolean): AppliedAllocationRun {
  return {
    runId: row.id,
    settlementRef: row.settlement_ref,
    policyKey: row.policy_key,
    policyVersion: row.version,
    sourceAmountMinor: BigInt(row.source_amount_minor),
    currency: row.currency,
    allocationCount: Number(row.allocation_count),
    idempotentReplay,
  };
}

function assertReplayCompatible(row: ExistingRunRow, input: ApplyAllocationRunInput): void {
  if (
    row.policy_key !== input.policyKey ||
    row.version !== input.policyVersion ||
    BigInt(row.source_amount_minor) !== input.sourceAmountMinor ||
    row.currency !== input.currency
  ) {
    throw new Error("settlement_allocation_replay_conflict");
  }
}

/**
 * Commits one economic allocation event atomically inside financeDb.
 *
 * The settlement reference is the idempotency boundary. A retry with identical
 * policy/source terms returns the original run; a conflicting retry fails closed.
 * Every allocation and payable credit commits in the same SQL transaction.
 */
export async function applyAllocationRun(input: ApplyAllocationRunInput): Promise<AppliedAllocationRun> {
  validateApplyInput(input);
  const tx = await financeDb.begin();
  try {
    await tx.rawExec("SELECT pg_advisory_xact_lock(hashtext($1))", `split-allocation:${input.settlementRef}`);

    const existing = await tx.rawQueryRow<ExistingRunRow>(
      `SELECT r.id, r.settlement_ref, p.policy_key, p.version,
              r.source_amount_minor::text AS source_amount_minor, r.currency,
              COUNT(a.id)::text AS allocation_count
         FROM settlement_allocation_runs r
         JOIN split_policies p ON p.id = r.policy_id
         LEFT JOIN settlement_allocations a ON a.allocation_run_id = r.id
        WHERE r.settlement_ref = $1
        GROUP BY r.id, p.policy_key, p.version`,
      input.settlementRef,
    );
    if (existing) {
      assertReplayCompatible(existing, input);
      await tx.commit();
      return mapExisting(existing, true);
    }

    const policy = await tx.rawQueryRow<{ id: string; status: string; currency: string; minor_unit_scale: number }>(
      `SELECT id, status, currency, minor_unit_scale
         FROM split_policies
        WHERE policy_key = $1 AND version = $2
        FOR SHARE`,
      input.policyKey,
      input.policyVersion,
    );
    if (!policy) throw new Error("split_policy_not_found");
    if (policy.status !== "active") throw new Error("split_policy_not_active");
    if (policy.currency !== input.currency) throw new Error("split_policy_currency_mismatch");

    const runId = crypto.randomUUID();
    await tx.rawExec(
      `INSERT INTO settlement_allocation_runs
        (id, settlement_ref, policy_id, source_amount_minor, currency, metadata)
       VALUES ($1, $2, $3, $4::bigint, $5, $6::jsonb)`,
      runId,
      input.settlementRef,
      policy.id,
      input.sourceAmountMinor.toString(),
      input.currency,
      JSON.stringify(input.metadata ?? {}),
    );

    for (const allocation of input.allocations) {
      const allocationId = crypto.randomUUID();
      await tx.rawExec(
        `INSERT INTO settlement_allocations
          (id, allocation_run_id, rule_code, source_recipient_type, recipient_type, recipient_ref,
           amount_minor, basis_points, remainder_minor, fallback_applied, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7::bigint, $8, $9::bigint, $10, '{}'::jsonb)`,
        allocationId,
        runId,
        allocation.ruleCode,
        allocation.sourceRecipientType,
        allocation.recipientType,
        allocation.recipientRef,
        allocation.amountMinor.toString(),
        allocation.basisPoints,
        allocation.remainderMinor.toString(),
        allocation.fallbackApplied,
      );

      if (allocation.amountMinor === 0n) continue;

      const account = await tx.rawQueryRow<{ id: string }>(
        `INSERT INTO payable_accounts (owner_type, owner_ref, currency)
         VALUES ($1, $2, $3)
         ON CONFLICT (owner_type, owner_ref, currency)
         DO UPDATE SET updated_at = payable_accounts.updated_at
         RETURNING id`,
        allocation.recipientType,
        allocation.recipientRef,
        input.currency,
      );
      if (!account) throw new Error("payable_account_not_resolved");

      await tx.rawExec(
        `INSERT INTO payable_entries
          (account_id, allocation_id, entry_type, amount_minor, direction,
           reference_type, reference_id, idempotency_key, metadata)
         VALUES ($1, $2, 'credit', $3::bigint, 1,
                 'settlement_allocation', $2::text, $4, '{}'::jsonb)`,
        account.id,
        allocationId,
        allocation.amountMinor.toString(),
        `allocation-credit:${allocationId}`,
      );
    }

    await tx.commit();
    return {
      runId,
      settlementRef: input.settlementRef,
      policyKey: input.policyKey,
      policyVersion: input.policyVersion,
      sourceAmountMinor: input.sourceAmountMinor,
      currency: input.currency,
      allocationCount: input.allocations.length,
      idempotentReplay: false,
    };
  } catch (error) {
    try { await tx.rollback(); } catch { /* transaction may already be closed */ }
    throw error;
  }
}
