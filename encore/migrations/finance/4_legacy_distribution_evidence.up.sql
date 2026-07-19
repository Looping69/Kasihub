-- Author: Klaasvaakie ( |╲ )
-- Imported payouts predate workflow operation IDs. Represent them in balanced
-- historical memo accounts so they have direct ledger evidence without changing
-- authoritative wallet balances that were established by the opening balance.
INSERT INTO ledger_accounts (id, owner_type, owner_id, account_code, currency, status)
VALUES (
  '00000000-0000-0000-0000-000000000010',
  'system',
  '00000000-0000-0000-0000-000000000010',
  'legacy_distribution_offset',
  'ZAR',
  'active'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO ledger_accounts (owner_type, owner_id, account_code, currency, status)
SELECT 'profile', payout.profile_id, 'legacy_distribution_memo', 'ZAR', 'active'
FROM pool_distributions payout
WHERE payout.status = 'paid'
  AND NOT EXISTS (
    SELECT 1 FROM ledger_accounts account
    WHERE account.owner_type = 'profile'
      AND account.owner_id = payout.profile_id
      AND account.account_code = 'legacy_distribution_memo'
      AND account.currency = 'ZAR'
  )
GROUP BY payout.profile_id;

INSERT INTO ledger_transactions (
  id, transaction_type, reference_type, reference_id, description, created_at
)
SELECT payout.id, 'legacy_pool_distribution', 'pool_distribution', payout.id,
       'Imported legacy pool distribution evidence', payout.payout_date
FROM pool_distributions payout
WHERE payout.status = 'paid'
  AND NOT EXISTS (
    SELECT 1 FROM ledger_transactions transaction
    WHERE transaction.reference_type = 'pool_distribution'
      AND transaction.reference_id = payout.id
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO ledger_entries (transaction_id, account_id, direction, amount, currency)
SELECT transaction.id,
       '00000000-0000-0000-0000-000000000010',
       'debit', payout.amount, 'ZAR'
FROM pool_distributions payout
JOIN ledger_transactions transaction
  ON transaction.reference_type = 'pool_distribution'
 AND transaction.reference_id = payout.id
WHERE payout.status = 'paid'
  AND NOT EXISTS (SELECT 1 FROM ledger_entries entry WHERE entry.transaction_id = transaction.id)
UNION ALL
SELECT transaction.id,
       account.id,
       'credit', payout.amount, 'ZAR'
FROM pool_distributions payout
JOIN ledger_transactions transaction
  ON transaction.reference_type = 'pool_distribution'
 AND transaction.reference_id = payout.id
JOIN ledger_accounts account
  ON account.owner_type = 'profile'
 AND account.owner_id = payout.profile_id
 AND account.account_code = 'legacy_distribution_memo'
 AND account.currency = 'ZAR'
WHERE payout.status = 'paid'
  AND NOT EXISTS (SELECT 1 FROM ledger_entries entry WHERE entry.transaction_id = transaction.id);
