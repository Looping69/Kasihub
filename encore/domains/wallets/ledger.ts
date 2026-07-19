// Author: Klaasvaakie ( |╲ )
import { financeDb } from "../../infrastructure/resources";

export async function ensureLedgerAccount(
  ownerType: string,
  ownerId: string,
  accountCode: string,
  currency: string,
): Promise<string> {
  const existing = await financeDb.rawQueryRow<{ id: string }>(
    `SELECT id FROM ledger_accounts
     WHERE owner_type = $1 AND owner_id = $2 AND account_code = $3 AND currency = $4`,
    ownerType,
    ownerId,
    accountCode,
    currency,
  );
  if (existing) return existing.id;

  const id = crypto.randomUUID();
  await financeDb.rawExec(
    `INSERT INTO ledger_accounts (id, owner_type, owner_id, account_code, currency, status)
     VALUES ($1, $2, $3, $4, $5, 'active')`,
    id,
    ownerType,
    ownerId,
    accountCode,
    currency,
  );
  return id;
}
