// Author: Klaasvaakie ( |╲ )
import { describe, expect, test } from "vitest";
import { idempotencyDecision, requestHash } from "./contracts";

describe("idempotency contracts", () => {
  test("equivalent objects produce the same request hash", () => {
    expect(requestHash({ quantity: 2, profileId: "a", nested: { z: 1, a: 2 } }))
      .toBe(requestHash({ nested: { a: 2, z: 1 }, profileId: "a", quantity: 2 }));
  });

  test("same key payload replays and changed payload conflicts", () => {
    const original = requestHash({ quantity: 2 });
    expect(idempotencyDecision(null, original)).toBe("create");
    expect(idempotencyDecision(original, requestHash({ quantity: 2 }))).toBe("replay");
    expect(idempotencyDecision(original, requestHash({ quantity: 3 }))).toBe("conflict");
  });
});
