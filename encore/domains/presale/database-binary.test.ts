import { describe, expect, it } from "vitest";

import { databaseBinaryToBuffer } from "./database-binary";

describe("databaseBinaryToBuffer", () => {
  it("accepts ArrayBuffer values returned for PostgreSQL bytea columns", () => {
    const bytes = Uint8Array.from([0, 17, 128, 255]);

    expect(databaseBinaryToBuffer(bytes.buffer)).toEqual(Buffer.from(bytes));
  });

  it("preserves the byte offset and length of typed-array views", () => {
    const bytes = Uint8Array.from([99, 10, 20, 30, 88]);
    const view = bytes.subarray(1, 4);

    expect(databaseBinaryToBuffer(view)).toEqual(Buffer.from([10, 20, 30]));
  });

  it("keeps Buffer values unchanged", () => {
    const value = Buffer.from("resume-token");

    expect(databaseBinaryToBuffer(value)).toBe(value);
  });
});
