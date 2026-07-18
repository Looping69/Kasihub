// Author: Klaasvaakie ( |╲ )
import { spawn } from "node:child_process";

if (!process.env.ENCORE_API_URL) {
  console.error("ENCORE_API_URL is required to start KaSiHUB.");
  process.exit(1);
}

const server = spawn(process.execPath, [".next/standalone/server.js"], {
  env: { ...process.env, NODE_ENV: "production" },
  stdio: "inherit",
});

server.on("error", (error) => {
  console.error("Failed to start the standalone server:", error);
  process.exitCode = 1;
});

server.on("exit", (code, signal) => {
  process.exitCode = signal ? 1 : (code ?? 1);
});
