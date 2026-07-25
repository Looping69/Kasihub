// Author: Klaasvaakie ( |╲ )
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { extname, join, relative } from "node:path";

const repositoryRoot = join(import.meta.dirname, "..", "..");
const legacyAliasDirectory = join(repositoryRoot, "src", "app", "api", "instapay");
const thisTest = join(repositoryRoot, "src", "lib", "kasipay-branding.test.ts");
const searchableExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".svg", ".html", ".css"]);

function filesUnder(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  });
}

describe("KaSiPay branding boundary", () => {
  it("keeps the legacy brand out of application copy, routes, and public assets", () => {
    // Persisted Encore response fields remain temporarily compatible at the API boundary.
    const compatibilityField = /instapay(?:Status|VerifiedAt|AccountRef|VerifiedCount|PendingCount)/gi;
    const roots = [join(repositoryRoot, "src"), join(repositoryRoot, "public", "kasipay-assets")];
    const violations = roots.flatMap(filesUnder)
      .filter((file) => searchableExtensions.has(extname(file)))
      .filter((file) => file !== thisTest && !file.startsWith(legacyAliasDirectory))
      .flatMap((file) => {
        const remaining = readFileSync(file, "utf8").replace(compatibilityField, "");
        return /instapay/i.test(remaining) ? [relative(repositoryRoot, file)] : [];
      });

    expect(violations).toEqual([]);
  });
});
