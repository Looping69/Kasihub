// Author: Klaasvaakie ( |╲ )
import { defineConfig } from "vitest/config";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      reportsDirectory: "coverage/critical-server",
      include: [
        "src/proxy.ts",
        "src/lib/encore-client.ts",
        "src/app/api/auth/**/*.ts",
        "src/app/api/members/route.ts",
        "src/app/api/dashboard/route.ts",
        "src/app/api/shares/buy/route.ts",
        "src/app/api/marketplace/order/route.ts",
        "src/app/api/rootsbank/purchase/route.ts",
        "src/app/api/admin/dividends/route.ts",
        "src/app/api/admin/pool/route.ts",
        "src/app/api/admin/operations/route.ts",
        "src/app/api/admin/reconciliation/route.ts",
        "src/app/api/admin/presale/**/*.ts",
        "src/app/api/presale/**/*.ts",
        "src/lib/presale-campaign.ts",
      ],
      thresholds: {
        statements: 80,
        branches: 70,
        functions: 80,
        lines: 80,
      },
    },
  },
});
