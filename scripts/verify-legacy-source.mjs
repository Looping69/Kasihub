// Author: Klaasvaakie ( |╲ )
import { DatabaseSync } from "node:sqlite";

const databasePath = process.argv.find((argument) => argument.endsWith(".db")) ?? "db/custom.db";
const database = new DatabaseSync(databasePath, { readOnly: true });
const transactions = database.prepare(`
  SELECT COUNT(*) AS count,
         COALESCE(SUM(amount), 0) AS walletBalance,
         SUM(CASE WHEN amount = 0 THEN 1 ELSE 0 END) AS zeroCount
  FROM "Transaction"
`).get();
const uniqueRoots = database.prepare("SELECT COUNT(DISTINCT memberId) AS count FROM RootsBankShare").get().count;
const notifications = database.prepare("SELECT memberId, daysBefore, sentAt FROM SubscriptionNotification").all();
database.close();

const uniqueNotifications = new Set(notifications.map((row) =>
  `${row.memberId}:${row.daysBefore}:${new Date(row.sentAt).toISOString().slice(0, 7)}`,
)).size;

process.stdout.write(`${JSON.stringify({
  databasePath,
  transactions: transactions.count,
  walletBalance: Number(transactions.walletBalance.toFixed(2)),
  zeroTransactions: transactions.zeroCount,
  expectedLedgerEntries: (transactions.count - transactions.zeroCount) * 2,
  uniqueRootsBankPioneers: uniqueRoots,
  uniqueSubscriptionNotifications: uniqueNotifications,
}, null, 2)}\n`);
