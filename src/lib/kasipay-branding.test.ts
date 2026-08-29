// Author: Klaasvaakie ( |╲ )
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { extname, join, relative } from "node:path";

const repositoryRoot = join(import.meta.dirname, "..", "..");
const legacyAliasDirectory = join(repositoryRoot, "src", "app", "api", "instapay");
const thisTest = join(repositoryRoot, "src", "lib", "kasipay-branding.test.ts");
const adminMembers = join(repositoryRoot, "src", "components", "admin", "admin-members.tsx");
const searchableExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".svg", ".html", ".css"]);

function isTestFixture(file: string) {
  return /(?:^|[\\/])[^\\/]+\.(?:test|spec)\.[^.]+$/i.test(file);
}

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
      // Contract fixtures deliberately exercise legacy compatibility fields.
      // They are not shipped application copy, routes, or public assets.
      .filter((file) => file !== thisTest && !isTestFixture(file) && !file.startsWith(legacyAliasDirectory))
      .flatMap((file) => {
        let remaining = readFileSync(file, "utf8").replace(compatibilityField, "");
        // The private member record names InstaPay as the actual external presale payment rail.
        // This is provider attribution, not a revival of the legacy public-facing platform brand.
        if (file === adminMembers) remaining = remaining.replaceAll("InstaPay", "");
        return /instapay/i.test(remaining) ? [relative(repositoryRoot, file)] : [];
      });

    expect(violations).toEqual([]);
  });
});
