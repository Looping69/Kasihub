// Author: Klaasvaakie ( |╲ )
import { DatabaseSync } from "node:sqlite";

const databasePath = process.argv[2] ?? "db/custom.db";
const database = new DatabaseSync(databasePath, { readOnly: true });
const tables = database.prepare(
  "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma%' ORDER BY name",
).all();

for (const { name } of tables) {
  if (typeof name !== "string" || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) continue;
  const count = database.prepare(`SELECT COUNT(*) AS count FROM "${name}"`).get().count;
  process.stdout.write(`${name}\t${count}\n`);
  if (process.argv.includes("--schema")) {
    const columns = database.prepare(`PRAGMA table_info("${name}")`).all();
    process.stdout.write(`  ${columns.map((column) => `${column.name}:${column.type}`).join(" | ")}\n`);
  }
}

database.close();
