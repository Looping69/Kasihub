// Author: Klaasvaakie ( |╲ )
import { api } from "encore.dev/api";
import { z } from "zod";
import { financeDb, networkDb } from "../../resources";
import { requireAdminAccess, requireEcosystemProfileAccess } from "../auth/access";
import { ensureAuthoritativeWallet } from "../workflows/core";

const ledgerEntry = z.object({
  direction: z.enum(["debit", "credit"]),
  amount: z.number().positive(),
});

export const validateLedger = api<{ entries: unknown[] }, { balanced: boolean }>(
  { method: "POST", path: "/ledger/validate", expose: true },
  async (req) => {
    const entries = z.array(ledgerEntry).parse(req.entries);
    const total = entries.reduce((sum, entry) => {
      return entry.direction === "credit" ? sum + entry.amount : sum - entry.amount;
    }, 0);
    return { balanced: Math.abs(total) < 0.000001 };
  },
);

export const walletMe = api<
  { profileId: string },
  {
    balance: string;
    currency: string;
    transactions: { id: string; type: string; amount: number; description: string; status: string; createdAt: string }[];
  }
>(
  { method: "GET", path: "/wallets/me/:profileId", expose: true },
  async (req) => {
    await requireEcosystemProfileAccess(req.profileId);
    const legacyWallet = await networkDb.rawQueryRow<{ currency: string }>(
      "SELECT currency FROM wallets WHERE profile_id = $1 ORDER BY created_at DESC LIMIT 1", req.profileId);
    await ensureAuthoritativeWallet(req.profileId, legacyWallet?.currency ?? "ZAR");
    const wallet = await financeDb.rawQueryRow<{ available_balance: string; currency: string }>(
      "SELECT available_balance::text AS available_balance, currency FROM wallet_balances WHERE profile_id = $1 AND currency = $2",
      req.profileId, legacyWallet?.currency ?? "ZAR");
    const transactions = await financeDb.rawQueryAll<{
      id: string;
      transaction_type: string;
      description: string;
      amount: string;
      created_at: string;
    }>(
      `SELECT lt.id, lt.transaction_type, lt.description, lt.created_at,
              COALESCE(SUM(CASE WHEN le.direction = 'credit' THEN le.amount ELSE -le.amount END), 0)::text AS amount
       FROM ledger_transactions lt
       JOIN ledger_entries le ON le.transaction_id = lt.id
       JOIN ledger_accounts la ON la.id = le.account_id
       WHERE la.owner_type = 'profile' AND la.owner_id = $1
       GROUP BY lt.id, lt.transaction_type, lt.description, lt.created_at
       ORDER BY lt.created_at DESC
       LIMIT 100`,
      req.profileId,
    );
    return {
      balance: wallet?.available_balance ?? "0.00",
      currency: wallet?.currency ?? "ZAR",
      transactions: transactions.map((transaction) => ({
        id: transaction.id,
        type: transaction.transaction_type.toUpperCase(),
        amount: Number(transaction.amount),
        description: transaction.description,
        status: "COMPLETED",
        createdAt: transaction.created_at,
      })),
    };
  },
);

export const listLedgerTransactions = api<
  void,
  {
    transactions: {
      id: string;
      transactionType: string;
      referenceType: string;
      referenceId: string;
      description: string;
      createdAt: string;
      profileId: string | null;
      amount: number;
    }[];
  }
>(
  { method: "GET", path: "/admin/ledger/transactions", expose: true },
  async () => {
    await requireAdminAccess();
    const rows = await financeDb.rawQueryAll<{
      id: string;
      transaction_type: string;
      reference_type: string;
      reference_id: string;
      description: string;
      created_at: string;
      profile_id: string | null;
      amount: string;
    }>(`SELECT lt.id, lt.transaction_type, lt.reference_type, lt.reference_id, lt.description, lt.created_at,
              MAX(CASE WHEN la.owner_type = 'profile' THEN la.owner_id::text END) AS profile_id,
              COALESCE(SUM(CASE
                WHEN la.owner_type = 'profile' AND le.direction = 'credit' THEN le.amount
                WHEN la.owner_type = 'profile' AND le.direction = 'debit' THEN -le.amount
                ELSE 0 END), 0)::text AS amount
       FROM ledger_transactions lt
       LEFT JOIN ledger_entries le ON le.transaction_id = lt.id
       LEFT JOIN ledger_accounts la ON la.id = le.account_id
       GROUP BY lt.id
       ORDER BY lt.created_at DESC
       LIMIT 200`,
    );
    return {
      transactions: rows.map((row) => ({
        id: row.id,
        transactionType: row.transaction_type,
        referenceType: row.reference_type,
        referenceId: row.reference_id,
        description: row.description,
        createdAt: row.created_at,
        profileId: row.profile_id,
        amount: Number(row.amount),
      })),
    };
  },
);
















