import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";

describe("development sentinel interaction boundary", () => {
  test("keeps diagnostics available without an automatic blocking popup", async () => {
    const source = await readFile(path.join(process.cwd(), "src", "devtools", "dev-sentinel.tsx"), "utf8");
    expect(source).toContain('aria-label="Development diagnostics"');
    expect(source).toContain('aria-expanded={open}');
    expect(source).not.toContain("newestHighPriority");
    expect(source).not.toContain('role="alert"');
  });
});
