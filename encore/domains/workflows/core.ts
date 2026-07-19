// Author: Klaasvaakie ( |╲ )
import { APIError } from "encore.dev/api";
import * as log from "encore.dev/log";
import { financeDb, networkDb } from "../../infrastructure/resources";
import { requestHeader } from "../auth/access";
import { idempotencyDecision, requestHash, sha256 } from "./contracts";

export { requestHash } from "./contracts";

export type OperationState = "pending" | "processing" | "completed" | "compensating" | "failed";

export interface FinancialOperation<T = unknown> {
  id: string;
  operationType: string;
  actorUserId: string | null;
  profileId: string | null;
  idempotencyKeyHash: string;
  createdAt: string;
  state: OperationState;
  result: T | null;
  retryCount: number;
}

export function requireIdempotencyKey(): string {
  const key = requestHeader("idempotency-key").trim();
  if (key.length < 16 || key.length > 200) {
    throw APIError.invalidArgument("Idempotency-Key must contain 16 to 200 characters");
  }
  return key;
}

export async function beginOperation<T>(input: {
  operationType: string;
  actorUserId: string;
  profileId?: string;
  idempotencyKey: string;
  payload: unknown;
}): Promise<{ operation: FinancialOperation<T>; replay: boolean }> {
  const idempotencyKeyHash = sha256(input.idempotencyKey);
  const payloadHash = requestHash(input.payload);
  const existing = await financeDb.rawQueryRow<{
    id: string; operation_type: string; actor_user_id: string | null; profile_id: string | null; idempotency_key_hash: string; request_hash: string; created_at: string; state: OperationState; result: T | null; retry_count: number;
  }>(`SELECT id, operation_type, actor_user_id, profile_id, idempotency_key_hash, request_hash, created_at, state, result, retry_count
      FROM financial_operations WHERE operation_type = $1 AND idempotency_key_hash = $2`, input.operationType, idempotencyKeyHash);
  if (existing) {
    if (idempotencyDecision(existing.request_hash, payloadHash) === "conflict") throw APIError.alreadyExists("Idempotency-Key was already used with a different request");
    return { operation: mapOperation(existing), replay: true };
  }

  const id = crypto.randomUUID();
  try {
    const row = await financeDb.rawQueryRow<{
      id: string; operation_type: string; actor_user_id: string | null; profile_id: string | null; idempotency_key_hash: string; created_at: string; state: OperationState; result: T | null; retry_count: number;
    }>(`INSERT INTO financial_operations
       (id, operation_type, actor_user_id, profile_id, idempotency_key_hash, request_hash, request_payload, state)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, 'processing')
       RETURNING id, operation_type, actor_user_id, profile_id, idempotency_key_hash, created_at, state, result, retry_count`,
      id, input.operationType, input.actorUserId, input.profileId ?? null, idempotencyKeyHash, payloadHash, JSON.stringify(input.payload));
    if (!row) throw new Error("operation_not_created");
    const operation = mapOperation(row);
    log.info("financial workflow started", workflowFields(operation, "start", "processing"));
    return { operation, replay: false };
  } catch (error) {
    const raced = await financeDb.rawQueryRow<{
      id: string; operation_type: string; actor_user_id: string | null; profile_id: string | null; idempotency_key_hash: string; request_hash: string; created_at: string; state: OperationState; result: T | null; retry_count: number;
    }>(`SELECT id, operation_type, actor_user_id, profile_id, idempotency_key_hash, request_hash, created_at, state, result, retry_count
        FROM financial_operations WHERE operation_type = $1 AND idempotency_key_hash = $2`, input.operationType, idempotencyKeyHash);
    if (!raced || raced.request_hash !== payloadHash) throw error;
    return { operation: mapOperation(raced), replay: true };
  }
}

export async function recordStep(operation: FinancialOperation, stepName: string, state: OperationState, details: Record<string, unknown> = {}, error?: unknown) {
  const message = error instanceof Error ? error.message : error ? String(error) : null;
  await financeDb.rawExec(`INSERT INTO financial_operation_steps
      (operation_id, step_name, state, attempt_count, details, last_error, started_at, completed_at, updated_at)
      VALUES ($1, $2, $3, 1, $4::jsonb, $5, now(), CASE WHEN $3 IN ('completed','failed') THEN now() ELSE NULL END, now())
      ON CONFLICT (operation_id, step_name) DO UPDATE SET
        state = EXCLUDED.state, attempt_count = financial_operation_steps.attempt_count + 1,
        details = EXCLUDED.details, last_error = EXCLUDED.last_error,
        completed_at = EXCLUDED.completed_at, updated_at = now()`,
    operation.id, stepName, state, JSON.stringify(details), message);
  const fields = workflowFields(operation, stepName, state);
  if (state === "failed") log.error(error ?? new Error(message ?? "workflow step failed"), "financial workflow step failed", fields);
  else log.info("financial workflow transition", fields);
}

export async function completeOperation<T>(operation: FinancialOperation<T>, result: T): Promise<T> {
  await financeDb.rawExec(`UPDATE financial_operations SET state = 'completed', result = $2::jsonb,
      last_error = NULL, completed_at = now(), updated_at = now() WHERE id = $1`, operation.id, JSON.stringify(result));
  log.info("financial workflow completed", workflowFields(operation, "complete", "completed"));
  return result;
}

export async function failOperation(operation: FinancialOperation, error: unknown, compensating = false): Promise<never> {
  const message = error instanceof Error ? error.message : String(error);
  const state = compensating ? "compensating" : "failed";
  await financeDb.rawExec(`UPDATE financial_operations SET state = $2, last_error = $3,
      retry_count = retry_count + 1, updated_at = now() WHERE id = $1`, operation.id, state, message.slice(0, 1000));
  log.error(error, "financial workflow failed", workflowFields({ ...operation, retryCount: operation.retryCount + 1 }, "failure", state));
  throw error;
}

export async function ensureAuthoritativeWallet(profileId: string, currency: string): Promise<void> {
  const existing = await financeDb.rawQueryRow<{ id: string }>("SELECT id FROM wallet_balances WHERE profile_id = $1 AND currency = $2", profileId, currency);
  if (existing) return;
  const legacy = await networkDb.rawQueryRow<{ cached_balance: string; currency: string }>(
    "SELECT cached_balance::text AS cached_balance, currency FROM wallets WHERE profile_id = $1", profileId);
  if (legacy && legacy.currency !== currency) throw APIError.failedPrecondition("Wallet currency does not match transaction currency");
  const openingBalance = legacy?.cached_balance ?? "0.00";
  const tx = await financeDb.begin();
  try {
    await tx.rawExec("SELECT pg_advisory_xact_lock(hashtext($1))", `wallet-open:${profileId}:${currency}`);
    const inserted = await tx.rawQueryRow<{ id: string }>(`INSERT INTO wallet_balances (profile_id, currency, available_balance)
      VALUES ($1, $2, $3::numeric) ON CONFLICT (profile_id, currency) DO NOTHING RETURNING id`, profileId, currency, openingBalance);
    if (inserted && Number(openingBalance) > 0) {
      const memberAccount = await ensureLedgerAccountTx(tx, "profile", profileId, "wallet", currency);
      const openingAccount = await ensureLedgerAccountTx(tx, "system", "00000000-0000-0000-0000-000000000000", "legacy_opening_balance", currency);
      const transactionId = crypto.randomUUID();
      await tx.rawExec(`INSERT INTO ledger_transactions (id, transaction_type, reference_type, reference_id, description)
        VALUES ($1, 'opening_balance', 'wallet_opening', $2, 'Legacy wallet opening balance')`, transactionId, profileId);
      await tx.rawExec(`INSERT INTO ledger_entries (transaction_id, account_id, direction, amount, currency)
        VALUES ($1, $2, 'debit', $3::numeric, $4), ($1, $5, 'credit', $3::numeric, $4)`,
        transactionId, openingAccount, openingBalance, currency, memberAccount);
    }
    await tx.commit();
  } catch (error) { await tx.rollback(); throw error; }
}

export async function placeWalletHold(operation: FinancialOperation, profileId: string, currency: string, amount: string): Promise<string> {
  await ensureAuthoritativeWallet(profileId, currency);
  const tx = await financeDb.begin();
  try {
    const prior = await tx.rawQueryRow<{ id: string; state: string }>("SELECT id, state FROM wallet_holds WHERE operation_id = $1", operation.id);
    if (prior) {
      await tx.commit();
      return prior.id;
    }
    const updated = await tx.rawQueryRow<{ id: string }>(`UPDATE wallet_balances
       SET available_balance = available_balance - $3::numeric,
           held_balance = held_balance + $3::numeric, version = version + 1, updated_at = now()
       WHERE profile_id = $1 AND currency = $2 AND status = 'active' AND available_balance >= $3::numeric
       RETURNING id`, profileId, currency, amount);
    if (!updated) throw APIError.failedPrecondition("Insufficient wallet funds");
    const holdId = crypto.randomUUID();
    await tx.rawExec(`INSERT INTO wallet_holds (id, operation_id, profile_id, currency, amount)
       VALUES ($1, $2, $3, $4, $5::numeric)`, holdId, operation.id, profileId, currency, amount);
    await tx.commit();
    return holdId;
  } catch (error) {
    await tx.rollback();
    throw error;
  }
}

export async function releaseWalletHold(operationId: string): Promise<void> {
  const tx = await financeDb.begin();
  try {
    const hold = await tx.rawQueryRow<{ id: string; profile_id: string; currency: string; amount: string; state: string }>(
      "SELECT id, profile_id, currency, amount::text AS amount, state FROM wallet_holds WHERE operation_id = $1 FOR UPDATE", operationId);
    if (!hold || hold.state === "released") { await tx.commit(); return; }
    if (hold.state === "captured") throw APIError.failedPrecondition("Captured funds cannot be released");
    await tx.rawExec(`UPDATE wallet_balances SET available_balance = available_balance + $3::numeric,
       held_balance = held_balance - $3::numeric, version = version + 1, updated_at = now()
       WHERE profile_id = $1 AND currency = $2`, hold.profile_id, hold.currency, hold.amount);
    await tx.rawExec("UPDATE wallet_holds SET state = 'released', updated_at = now() WHERE id = $1", hold.id);
    await tx.commit();
  } catch (error) { await tx.rollback(); throw error; }
}

export async function captureWalletHold(operation: FinancialOperation, accountCode: string, description: string): Promise<void> {
  const tx = await financeDb.begin();
  let committed = false;
  try {
    const hold = await tx.rawQueryRow<{ id: string; profile_id: string; currency: string; amount: string; state: string }>(
      "SELECT id, profile_id, currency, amount::text AS amount, state FROM wallet_holds WHERE operation_id = $1 FOR UPDATE", operation.id);
    if (!hold) throw new Error("wallet_hold_not_found");
    if (hold.state === "captured") { await tx.commit(); committed = true; return; }
    if (hold.state !== "held") throw APIError.failedPrecondition("Wallet hold is not capturable");
    await tx.rawExec("SELECT pg_advisory_xact_lock(hashtext($1))", `${hold.profile_id}:${hold.currency}:${accountCode}`);
    const memberAccount = await ensureLedgerAccountTx(tx, "profile", hold.profile_id, "wallet", hold.currency);
    const systemAccount = await ensureLedgerAccountTx(tx, "system", "00000000-0000-0000-0000-000000000000", accountCode, hold.currency);
    const transactionId = crypto.randomUUID();
    await tx.rawExec(`INSERT INTO ledger_transactions (id, transaction_type, reference_type, reference_id, description, created_by)
       VALUES ($1, $2, 'financial_operation', $3, $4, $5)`, transactionId, operation.operationType, operation.id, description, null);
    await tx.rawExec(`INSERT INTO ledger_entries (transaction_id, account_id, direction, amount, currency)
       VALUES ($1, $2, 'debit', $3::numeric, $4), ($1, $5, 'credit', $3::numeric, $4)`,
      transactionId, memberAccount, hold.amount, hold.currency, systemAccount);
    await tx.rawExec(`UPDATE wallet_balances SET held_balance = held_balance - $3::numeric,
       version = version + 1, updated_at = now() WHERE profile_id = $1 AND currency = $2`, hold.profile_id, hold.currency, hold.amount);
    await tx.rawExec("UPDATE wallet_holds SET state = 'captured', updated_at = now() WHERE id = $1", hold.id);
    await tx.commit();
    committed = true;
    const balance = await financeDb.rawQueryRow<{ available_balance: string }>(
      "SELECT available_balance::text AS available_balance FROM wallet_balances WHERE profile_id = $1 AND currency = $2",
      hold.profile_id, hold.currency);
    if (balance) {
      try {
        await networkDb.rawExec(`INSERT INTO wallets (profile_id, currency, status, cached_balance)
          VALUES ($1, $2, 'active', $3::numeric)
          ON CONFLICT (profile_id) DO UPDATE SET currency = EXCLUDED.currency, cached_balance = EXCLUDED.cached_balance`,
          hold.profile_id, hold.currency, balance.available_balance);
      } catch (error) {
        log.warn(error, "wallet compatibility projection update failed", { operationId: operation.id, profileId: hold.profile_id });
      }
    }
  } catch (error) { if (!committed) await tx.rollback(); throw error; }
}

export async function creditDistribution(input: {
  operation: FinancialOperation;
  profileId: string;
  amount: string;
  source: string;
  poolType: string;
}): Promise<string> {
  const tx = await financeDb.begin();
  let committed = false;
  try {
    const distributionId = crypto.randomUUID();
    const distribution = await tx.rawQueryRow<{ id: string; status: string }>(
      `INSERT INTO pool_distributions (id, batch_id, profile_id, amount, source, pool_type, status, operation_id)
       VALUES ($1, $2, $3, $4::numeric, $5, $6, 'pending', $2)
       ON CONFLICT (operation_id, profile_id) WHERE operation_id IS NOT NULL
       DO UPDATE SET source = EXCLUDED.source
       RETURNING id, status`,
      distributionId, input.operation.id, input.profileId, input.amount, input.source, input.poolType,
    );
    if (!distribution) throw new Error("distribution_not_created");
    if (distribution.status === "paid") { await tx.commit(); committed = true; return distribution.id; }
    await tx.rawExec(`INSERT INTO wallet_balances (profile_id, currency, available_balance)
       VALUES ($1, 'ZAR', 0) ON CONFLICT (profile_id, currency) DO NOTHING`, input.profileId);
    await tx.rawExec(`UPDATE wallet_balances SET available_balance = available_balance + $2::numeric,
       version = version + 1, updated_at = now() WHERE profile_id = $1 AND currency = 'ZAR'`, input.profileId, input.amount);
    await tx.rawExec("SELECT pg_advisory_xact_lock(hashtext($1))", `${input.profileId}:ZAR:distribution`);
    const memberAccount = await ensureLedgerAccountTx(tx, "profile", input.profileId, "wallet", "ZAR");
    const expenseCode = input.source === "DIVIDEND" ? "dividend_expense" : "pool_expense";
    const systemAccount = await ensureLedgerAccountTx(tx, "system", "00000000-0000-0000-0000-000000000000", expenseCode, "ZAR");
    const existingLedger = await tx.rawQueryRow<{ id: string }>(
      "SELECT id FROM ledger_transactions WHERE reference_type = 'pool_distribution' AND reference_id = $1 LIMIT 1", distribution.id);
    if (!existingLedger) {
      const transactionId = crypto.randomUUID();
      await tx.rawExec(`INSERT INTO ledger_transactions (id, transaction_type, reference_type, reference_id, description)
         VALUES ($1, $2, 'pool_distribution', $3, $4)`, transactionId,
        input.source === "DIVIDEND" ? "dividend" : "pool_payout", distribution.id, `${input.source} distribution`);
      await tx.rawExec(`INSERT INTO ledger_entries (transaction_id, account_id, direction, amount, currency)
         VALUES ($1, $2, 'debit', $3::numeric, 'ZAR'), ($1, $4, 'credit', $3::numeric, 'ZAR')`,
        transactionId, systemAccount, input.amount, memberAccount);
    }
    await tx.rawExec("UPDATE pool_distributions SET status = 'paid' WHERE id = $1", distribution.id);
    await tx.commit();
    committed = true;

    const balance = await financeDb.rawQueryRow<{ available_balance: string }>(
      "SELECT available_balance::text AS available_balance FROM wallet_balances WHERE profile_id = $1 AND currency = 'ZAR'", input.profileId);
    if (balance) {
      try {
        await networkDb.rawExec(`INSERT INTO wallets (profile_id, currency, status, cached_balance)
           VALUES ($1, 'ZAR', 'active', $2::numeric)
           ON CONFLICT (profile_id) DO UPDATE SET cached_balance = EXCLUDED.cached_balance, currency = EXCLUDED.currency`,
          input.profileId, balance.available_balance);
      } catch (error) {
        log.warn(error, "wallet compatibility projection update failed", { operationId: input.operation.id, profileId: input.profileId });
      }
    }
    return distribution.id;
  } catch (error) { if (!committed) await tx.rollback(); throw error; }
}

async function ensureLedgerAccountTx(tx: Awaited<ReturnType<typeof financeDb.begin>>, ownerType: string, ownerId: string, accountCode: string, currency: string): Promise<string> {
  const existing = await tx.rawQueryRow<{ id: string }>(`SELECT id FROM ledger_accounts
      WHERE owner_type = $1 AND owner_id = $2 AND account_code = $3 AND currency = $4 LIMIT 1`, ownerType, ownerId, accountCode, currency);
  if (existing) return existing.id;
  const id = crypto.randomUUID();
  await tx.rawExec(`INSERT INTO ledger_accounts (id, owner_type, owner_id, account_code, currency, status)
      VALUES ($1, $2, $3, $4, $5, 'active')`, id, ownerType, ownerId, accountCode, currency);
  return id;
}

function mapOperation<T>(row: { id: string; operation_type: string; actor_user_id: string | null; profile_id: string | null; idempotency_key_hash: string; created_at: string; state: OperationState; result: T | null; retry_count: number }): FinancialOperation<T> {
  return {
    id: row.id,
    operationType: row.operation_type,
    actorUserId: row.actor_user_id,
    profileId: row.profile_id,
    idempotencyKeyHash: row.idempotency_key_hash,
    createdAt: row.created_at,
    state: row.state,
    result: row.result,
    retryCount: row.retry_count,
  };
}

function workflowFields(operation: FinancialOperation, step: string, result: string) {
  return {
    operationId: operation.id,
    idempotencyKeyHash: operation.idempotencyKeyHash,
    actorUserId: operation.actorUserId,
    profileId: operation.profileId,
    operationType: operation.operationType,
    step,
    result,
    durationMs: Math.max(0, Date.now() - new Date(operation.createdAt).getTime()),
    retryCount: operation.retryCount,
  };
}
