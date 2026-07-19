// Author: Klaasvaakie ( |╲ )
import { describe, expect, test } from "vitest";
import { financeDb, networkDb, sharesDb } from "../../resources";
import { ensureMembershipPlan } from "../membership/plans";
import { placeMatrixNode } from "../network/placement";
import { ensureLedgerAccount } from "../wallets/ledger";
import {
  beginOperation,
  captureWalletHold,
  completeOperation,
  creditDistribution,
  failOperation,
  placeWalletHold,
  recordStep,
  releaseWalletHold,
} from "../workflows/core";

describe("database financial contracts", () => {
  test("conditional inventory reservation cannot oversell under concurrency", async () => {
    const phaseNumber = 900_000 + Math.floor(Math.random() * 90_000);
    await sharesDb.rawExec(`INSERT INTO share_phases
      (phase_number, quantity_available, total_quantity, price_per_share, currency, status, starts_at)
      VALUES ($1, 5, 5, 1.00, 'ZAR', 'active', now())`, phaseNumber);
    const attempts = await Promise.all(Array.from({ length: 20 }, () => sharesDb.rawQueryRow<{ id: string }>(
      `UPDATE share_phases SET quantity_available = quantity_available - 1
       WHERE phase_number = $1 AND status = 'active' AND quantity_available >= 1 RETURNING id`, phaseNumber)));
    expect(attempts.filter(Boolean)).toHaveLength(5);
    const phase = await sharesDb.rawQueryRow<{ quantity_available: number }>(
      "SELECT quantity_available FROM share_phases WHERE phase_number = $1", phaseNumber);
    expect(phase?.quantity_available).toBe(0);
  });

  test("bonus shares consume inventory atomically", async () => {
    const phaseNumber = 990_000 + Math.floor(Math.random() * 9_000);
    await sharesDb.rawExec(`INSERT INTO share_phases
      (phase_number, quantity_available, total_quantity, price_per_share, currency, status, starts_at, bonus_buy_one_get)
      VALUES ($1, 6, 6, 1.00, 'ZAR', 'active', now(), true)`, phaseNumber);

    const attempts = await Promise.all(Array.from({ length: 10 }, () => sharesDb.rawQueryRow<{ id: string }>(
      `UPDATE share_phases
       SET quantity_available = quantity_available - CASE WHEN bonus_buy_one_get THEN $2 * 2 ELSE $2 END
       WHERE phase_number = $1 AND status = 'active'
         AND quantity_available >= CASE WHEN bonus_buy_one_get THEN $2 * 2 ELSE $2 END
       RETURNING id`, phaseNumber, 2)));

    expect(attempts.filter(Boolean)).toHaveLength(1);
    const phase = await sharesDb.rawQueryRow<{ quantity_available: number }>(
      "SELECT quantity_available FROM share_phases WHERE phase_number = $1", phaseNumber);
    expect(phase?.quantity_available).toBe(2);
  });

  test("operation idempotency key is unique per workflow type", async () => {
    const keyHash = crypto.randomUUID().replaceAll("-", "");
    const requestHash = crypto.randomUUID().replaceAll("-", "");
    const create = () => financeDb.rawExec(`INSERT INTO financial_operations
      (operation_type, idempotency_key_hash, request_hash, request_payload)
      VALUES ('contract_test', $1, $2, '{}'::jsonb)`, keyHash, requestHash);
    const results = await Promise.allSettled([create(), create()]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
  });

  test("balanced ledger transaction has equal debit and credit totals", async () => {
    const ownerId = crypto.randomUUID();
    const debitAccount = crypto.randomUUID();
    const creditAccount = crypto.randomUUID();
    const transactionId = crypto.randomUUID();
    await financeDb.rawExec(`INSERT INTO ledger_accounts (id, owner_type, owner_id, account_code, currency)
      VALUES ($1, 'profile', $3, 'wallet', 'ZAR'), ($2, 'system', $3, 'test_revenue', 'ZAR')`,
      debitAccount, creditAccount, ownerId);
    await financeDb.rawExec(`INSERT INTO ledger_transactions (id, transaction_type, reference_type, reference_id, description)
      VALUES ($1, 'contract_test', 'contract_test', $2, 'Balanced contract test')`, transactionId, crypto.randomUUID());
    await financeDb.rawExec(`INSERT INTO ledger_entries (transaction_id, account_id, direction, amount, currency)
      VALUES ($1, $2, 'debit', 10.01, 'ZAR'), ($1, $3, 'credit', 10.01, 'ZAR')`,
      transactionId, debitAccount, creditAccount);
    const totals = await financeDb.rawQueryRow<{ debits: string; credits: string }>(`SELECT
      SUM(CASE WHEN direction = 'debit' THEN amount ELSE 0 END)::text AS debits,
      SUM(CASE WHEN direction = 'credit' THEN amount ELSE 0 END)::text AS credits
      FROM ledger_entries WHERE transaction_id = $1`, transactionId);
    expect(totals?.debits).toBe(totals?.credits);
  });

  test("membership plan materialization is idempotent under retries", async () => {
    const code = `CONTRACT_${crypto.randomUUID().replaceAll("-", "")}`;
    const first = await ensureMembershipPlan(code);
    const replay = await ensureMembershipPlan(code);
    expect(replay.id).toBe(first.id);
    expect(first.amount).toBe("140.00");
    expect(first.currency).toBe("ZAR");
  });

  test("matrix placement and ledger account creation are idempotent", async () => {
    const profileId = crypto.randomUUID();
    const node = await placeMatrixNode(profileId, null);
    const replayedNode = await placeMatrixNode(profileId, null);
    expect(replayedNode).toEqual(node);

    const account = await ensureLedgerAccount("profile", profileId, "contract_wallet", "ZAR");
    const replayedAccount = await ensureLedgerAccount("profile", profileId, "contract_wallet", "ZAR");
    expect(replayedAccount).toBe(account);
  });

  test("matrix placement fills a child position beneath an existing root", async () => {
    const rootProfileId = crypto.randomUUID();
    const childProfileId = crypto.randomUUID();
    const root = await placeMatrixNode(rootProfileId, null);
    const child = await placeMatrixNode(childProfileId, rootProfileId);

    expect(child.parentNodeId).not.toBeNull();
    expect(child.parentNodeId).not.toBe(child.id);
    expect(child.depth).toBeGreaterThan(root.depth);
    expect(child.path).not.toBe("0");
    expect(child.sponsorProfileId).toBe(rootProfileId);
  });

  test("wallet hold lifecycle is atomic, replayable, and ledger backed", async () => {
    const profileId = crypto.randomUUID();
    const actorUserId = crypto.randomUUID();
    await networkDb.rawExec(
      "INSERT INTO wallets (profile_id, currency, cached_balance) VALUES ($1, 'ZAR', 100.00)",
      profileId,
    );
    const idempotencyKey = crypto.randomUUID();
    const started = await beginOperation<{ ok: true }>({
      operationType: "contract_wallet_capture",
      actorUserId,
      profileId,
      idempotencyKey,
      payload: { amount: "30.00" },
    });
    expect(started.replay).toBe(false);
    const replay = await beginOperation<{ ok: true }>({
      operationType: started.operation.operationType,
      actorUserId,
      profileId,
      idempotencyKey,
      payload: { amount: "30.00" },
    });
    expect(replay.replay).toBe(true);
    expect(replay.operation.id).toBe(started.operation.id);
    await expect(beginOperation({
      operationType: started.operation.operationType,
      actorUserId,
      profileId,
      idempotencyKey,
      payload: { amount: "31.00" },
    })).rejects.toThrow("Idempotency-Key was already used with a different request");

    const holdId = await placeWalletHold(started.operation, profileId, "ZAR", "30.00");
    expect(await placeWalletHold(started.operation, profileId, "ZAR", "30.00")).toBe(holdId);
    await recordStep(started.operation, "hold_wallet_funds", "completed", { amount: "30.00" });
    await captureWalletHold(started.operation, "contract_revenue", "Contract capture");
    await captureWalletHold(started.operation, "contract_revenue", "Contract capture replay");
    await completeOperation(started.operation, { ok: true });

    const balance = await financeDb.rawQueryRow<{ available: string; held: string }>(
      "SELECT available_balance::text AS available, held_balance::text AS held FROM wallet_balances WHERE profile_id = $1 AND currency = 'ZAR'",
      profileId,
    );
    expect(balance).toEqual({ available: "70.00", held: "0.00" });
    const projection = await networkDb.rawQueryRow<{ balance: string }>(
      "SELECT cached_balance::text AS balance FROM wallets WHERE profile_id = $1",
      profileId,
    );
    expect(projection?.balance).toBe("70.00");
    const ledger = await financeDb.rawQueryRow<{ debits: string; credits: string }>(`SELECT
      SUM(CASE WHEN direction = 'debit' THEN amount ELSE 0 END)::text AS debits,
      SUM(CASE WHEN direction = 'credit' THEN amount ELSE 0 END)::text AS credits
      FROM ledger_entries entry JOIN ledger_transactions transaction ON transaction.id = entry.transaction_id
      WHERE transaction.reference_type = 'financial_operation' AND transaction.reference_id = $1`, started.operation.id);
    expect(ledger?.debits).toBe("30.00");
    expect(ledger?.credits).toBe("30.00");
  });

  test("held funds release exactly once and insufficient funds fail closed", async () => {
    const profileId = crypto.randomUUID();
    const actorUserId = crypto.randomUUID();
    await networkDb.rawExec("INSERT INTO wallets (profile_id, currency, cached_balance) VALUES ($1, 'ZAR', 20.00)", profileId);
    const operation = (await beginOperation({
      operationType: "contract_wallet_release", actorUserId, profileId,
      idempotencyKey: crypto.randomUUID(), payload: { amount: "10.00" },
    })).operation;
    await placeWalletHold(operation, profileId, "ZAR", "10.00");
    await releaseWalletHold(operation.id);
    await releaseWalletHold(operation.id);
    const balance = await financeDb.rawQueryRow<{ available: string; held: string }>(
      "SELECT available_balance::text AS available, held_balance::text AS held FROM wallet_balances WHERE profile_id = $1 AND currency = 'ZAR'",
      profileId,
    );
    expect(balance).toEqual({ available: "20.00", held: "0.00" });

    const rejected = (await beginOperation({
      operationType: "contract_insufficient_funds", actorUserId, profileId,
      idempotencyKey: crypto.randomUUID(), payload: { amount: "21.00" },
    })).operation;
    await expect(placeWalletHold(rejected, profileId, "ZAR", "21.00")).rejects.toThrow("Insufficient wallet funds");
    expect(await financeDb.rawQueryRow("SELECT id FROM wallet_holds WHERE operation_id = $1", rejected.id)).toBeNull();
    await expect(failOperation(rejected, new Error("Insufficient wallet funds"))).rejects.toThrow("Insufficient wallet funds");
    const state = await financeDb.rawQueryRow<{ state: string }>("SELECT state FROM financial_operations WHERE id = $1", rejected.id);
    expect(state?.state).toBe("failed");
  });

  test("wallet compatibility rejects currency drift and preserves legacy deficits", async () => {
    const mismatchProfileId = crypto.randomUUID();
    await networkDb.rawExec(
      "INSERT INTO wallets (profile_id, currency, cached_balance) VALUES ($1, 'USD', 25.00)",
      mismatchProfileId,
    );
    const mismatchOperation = (await beginOperation({
      operationType: "contract_currency_mismatch",
      actorUserId: crypto.randomUUID(),
      profileId: mismatchProfileId,
      idempotencyKey: crypto.randomUUID(),
      payload: { amount: "1.00", currency: "ZAR" },
    })).operation;
    await expect(placeWalletHold(mismatchOperation, mismatchProfileId, "ZAR", "1.00"))
      .rejects.toThrow("Wallet currency does not match transaction currency");

    const deficitProfileId = crypto.randomUUID();
    await networkDb.rawExec(
      "INSERT INTO wallets (profile_id, currency, cached_balance) VALUES ($1, 'ZAR', -25.00)",
      deficitProfileId,
    );
    const deficitOperation = (await beginOperation({
      operationType: "contract_legacy_deficit",
      actorUserId: crypto.randomUUID(),
      profileId: deficitProfileId,
      idempotencyKey: crypto.randomUUID(),
      payload: { amount: "0.00" },
    })).operation;
    const holdId = await placeWalletHold(deficitOperation, deficitProfileId, "ZAR", "0.00");
    expect(holdId).toBeTruthy();
    const authoritative = await financeDb.rawQueryRow<{ available: string }>(
      "SELECT available_balance::text AS available FROM wallet_balances WHERE profile_id = $1 AND currency = 'ZAR'",
      deficitProfileId,
    );
    const projection = await networkDb.rawQueryRow<{ balance: string }>(
      "SELECT cached_balance::text AS balance FROM wallets WHERE profile_id = $1",
      deficitProfileId,
    );
    expect(authoritative?.available).toBe("0.00");
    expect(projection?.balance).toBe("0.00");
  });

  test("captured holds cannot be released and missing releases are harmless", async () => {
    await expect(releaseWalletHold(crypto.randomUUID())).resolves.toBeUndefined();

    const profileId = crypto.randomUUID();
    await networkDb.rawExec(
      "INSERT INTO wallets (profile_id, currency, cached_balance) VALUES ($1, 'ZAR', 15.00)",
      profileId,
    );
    const operation = (await beginOperation({
      operationType: "contract_captured_release",
      actorUserId: crypto.randomUUID(),
      profileId,
      idempotencyKey: crypto.randomUUID(),
      payload: { amount: "5.00" },
    })).operation;
    await placeWalletHold(operation, profileId, "ZAR", "5.00");
    await captureWalletHold(operation, "contract_revenue", "Captured release contract");
    await expect(releaseWalletHold(operation.id)).rejects.toThrow("Captured funds cannot be released");
  });

  test("step failures and compensating operations retain retry state", async () => {
    const operation = (await beginOperation({
      operationType: "contract_compensation",
      actorUserId: crypto.randomUUID(),
      idempotencyKey: crypto.randomUUID(),
      payload: { reason: "contract" },
    })).operation;
    await recordStep(operation, "compensate", "failed", {}, "rollback required");
    await expect(failOperation(operation, "rollback required", true)).rejects.toBe("rollback required");
    const state = await financeDb.rawQueryRow<{ state: string; retry_count: number }>(
      "SELECT state, retry_count FROM financial_operations WHERE id = $1",
      operation.id,
    );
    expect(state).toEqual({ state: "compensating", retry_count: 1 });
  });

  test("recipient credits are unique per operation and update the wallet projection", async () => {
    const profileId = crypto.randomUUID();
    const operation = (await beginOperation({
      operationType: "contract_distribution", actorUserId: crypto.randomUUID(),
      idempotencyKey: crypto.randomUUID(), payload: { amount: "12.34" },
    })).operation;
    const first = await creditDistribution({ operation, profileId, amount: "12.34", source: "DIVIDEND", poolType: "SHAREHOLDERS" });
    const replay = await creditDistribution({ operation, profileId, amount: "12.34", source: "DIVIDEND", poolType: "SHAREHOLDERS" });
    expect(replay).toBe(first);
    const balance = await financeDb.rawQueryRow<{ available: string }>(
      "SELECT available_balance::text AS available FROM wallet_balances WHERE profile_id = $1 AND currency = 'ZAR'", profileId);
    expect(balance?.available).toBe("12.34");
    const payouts = await financeDb.rawQueryRow<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM pool_distributions WHERE operation_id = $1 AND profile_id = $2", operation.id, profileId);
    expect(payouts?.count).toBe("1");
  });

  test("non-dividend distributions use the pool payout ledger path", async () => {
    const profileId = crypto.randomUUID();
    const operation = (await beginOperation({
      operationType: "contract_pool_distribution",
      actorUserId: crypto.randomUUID(),
      idempotencyKey: crypto.randomUUID(),
      payload: { amount: "7.89" },
    })).operation;
    const distributionId = await creditDistribution({
      operation,
      profileId,
      amount: "7.89",
      source: "POOL",
      poolType: "COMMUNITY",
    });
    const transaction = await financeDb.rawQueryRow<{ transaction_type: string }>(
      "SELECT transaction_type FROM ledger_transactions WHERE reference_type = 'pool_distribution' AND reference_id = $1",
      distributionId,
    );
    expect(transaction?.transaction_type).toBe("pool_payout");
  });
});
