// Author: Klaasvaakie ( |╲ )
import { describe, expect, test } from "vitest";
import { decodeStoredConfig } from "./theme-storage";

describe("decodeStoredConfig", () => {
  test("accepts JSONB values returned as objects", () => {
    expect(decodeStoredConfig({ status: "draft", theme: { name: "Classic" } })).toEqual({
      status: "draft", theme: { name: "Classic" },
    });
  });

  test("decodes JSONB values returned as serialized JSON", () => {
    expect(decodeStoredConfig('{"status":"published","theme":{"name":"Classic"}}')).toEqual({
      status: "published", theme: { name: "Classic" },
    });
  });

  test("rejects malformed or non-object values", () => {
    expect(decodeStoredConfig("not-json")).toBeNull();
    expect(decodeStoredConfig(null)).toBeNull();
    expect(decodeStoredConfig([])).toBeNull();
  });
});
