// ( |╲ ) Author: Klaasvaakie
import { cp, mkdir } from "node:fs/promises";

if (process.env.VERCEL === "1") {
  console.log("Skipping standalone asset copy on Vercel managed build.");
  process.exit(0);
}

await mkdir(".next/standalone/.next", { recursive: true });
await cp(".next/static", ".next/standalone/.next/static", { recursive: true, force: true });
await cp("public", ".next/standalone/public", { recursive: true, force: true });
