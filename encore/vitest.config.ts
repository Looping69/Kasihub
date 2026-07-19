// Author: Klaasvaakie ( |╲ )
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["domains/**/*.test.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      reportsDirectory: "coverage/backend",
      include: [
        "domains/workflows/contracts.ts",
        "domains/workflows/core.ts",
        "domains/finance/allocation.ts",
        "domains/auth/password.ts",
        "domains/membership/plans.ts",
        "domains/network/placement.ts",
        "domains/wallets/ledger.ts",
      ],
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80,
      },
    },
  },
});
