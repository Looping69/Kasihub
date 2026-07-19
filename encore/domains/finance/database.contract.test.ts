// Author: Klaasvaakie ( |╲ )
import { describe, expect, test } from "vitest";
import { financeDb, sharesDb } from "../../infrastructure/resources";

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
});
