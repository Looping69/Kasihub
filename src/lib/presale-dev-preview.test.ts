// Author: Klaasvaakie ( |╲ )
import { describe, expect, test } from "vitest";
import { isLocalPresalePreviewRequested } from "./presale-dev-preview";

describe("local presale preview boundary", () => {
  test("permits only the explicit query while running next dev", () => {
    expect(isLocalPresalePreviewRequested("1", "development")).toBe(true);
    expect(isLocalPresalePreviewRequested(undefined, "development")).toBe(false);
    expect(isLocalPresalePreviewRequested("true", "development")).toBe(false);
  });

  test("fails closed in test and production runtimes", () => {
    expect(isLocalPresalePreviewRequested("1", "test")).toBe(false);
    expect(isLocalPresalePreviewRequested("1", "production")).toBe(false);
  });
});
