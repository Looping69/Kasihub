// Author: Klaasvaakie ( |╲ )
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["domains/**/*.test.ts"],
    environment: "node",
  },
});
