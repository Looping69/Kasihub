import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

const root = resolve(import.meta.dirname, "../..");
const launcher = readFileSync(resolve(root, "scripts/start-encore-docker.ps1"), "utf8");
const dockerfile = readFileSync(resolve(root, "encore/Dockerfile.cli"), "utf8");

describe("containerized Encore launcher", () => {
  test("derives the CLI image version from the locked encore.dev package", () => {
    expect(launcher).toContain('$packageLock.packages."node_modules/encore.dev".version');
    expect(launcher).toContain('"ENCORE_VERSION=$encoreVersion"');
    expect(launcher).not.toMatch(/ENCORE_VERSION=1\.\d+\.\d+/);
  });

  test("keeps the runtime bundle and repository metadata available", () => {
    expect(dockerfile).toContain('bash -s -- "${ENCORE_VERSION}"');
    expect(dockerfile).toContain("cp -a /root/.encore/. /opt/encore/");
    expect(launcher).toContain('"${repoRoot}:/workspace"');
  });
});
