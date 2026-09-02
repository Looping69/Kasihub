import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";

describe("presale crypto payment copy", () => {
  test("uses compact mobile-safe verification actions", async () => {
    const source = await readFile(path.join(process.cwd(), "src", "app", "presale", "presale-client.tsx"), "utf8");
    expect(source).toContain('"Start verification"');
    expect(source).toContain('"Saving hash…"');
    expect(source).toContain('>Open applicant account</Link>');
    expect(source).not.toContain('"Submit transaction for confirmation"');
  });
});
