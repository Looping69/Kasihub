// Author: Klaasvaakie ( |╲ )
import { defineConfig } from "@playwright/test";

const port = Number(process.env.PLAYWRIGHT_PORT ?? 3100);

export default defineConfig({
  testDir: "./tests/browser",
  timeout: 30_000,
  use: { baseURL: `http://127.0.0.1:${port}`, trace: "retain-on-failure" },
  webServer: {
    command: "npm run start",
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: { ENCORE_API_URL: "http://127.0.0.1:4000", PORT: String(port) },
  },
});
