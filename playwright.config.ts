// Author: Klaasvaakie ( |╲ )
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  timeout: 30_000,
  use: { baseURL: "http://127.0.0.1:3000", trace: "retain-on-failure" },
  webServer: {
    command: "npm run start",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: true,
    timeout: 60_000,
    env: { ENCORE_API_URL: "http://127.0.0.1:4000", PORT: "3000" },
  },
});
