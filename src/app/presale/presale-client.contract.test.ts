import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";

describe("presale crypto payment copy", () => {
  test("uses the compact mobile-safe transaction action", async () => {
    const source = await readFile(path.join(process.cwd(), "src", "app", "presale", "presale-client.tsx"), "utf8");
    expect(source).toContain('"Submit hash"');
    expect(source).not.toContain('"Submit transaction for confirmation"');
  });
});
