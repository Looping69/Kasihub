// ( |╲ ) Author: Klaasvaakie
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const localDatabase = resolve("db/custom.db");
const databaseUrl = process.env.DATABASE_URL ?? (
  existsSync(localDatabase) ? `file:${localDatabase.replaceAll("\\", "/")}` : undefined
);

const server = spawn(process.execPath, [".next/standalone/server.js"], {
  // ( |╲ ) Author: Klaasvaakie — explicit deployment URLs win; local starts use the repo DB.
  env: { ...process.env, NODE_ENV: "production", ...(databaseUrl ? { DATABASE_URL: databaseUrl } : {}) },
  stdio: "inherit",
});

server.on("error", (error) => {
  console.error("Failed to start the standalone server:", error);
  process.exitCode = 1;
});

server.on("exit", (code, signal) => {
  process.exitCode = signal ? 1 : (code ?? 1);
});
