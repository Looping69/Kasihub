// Author: Klaasvaakie ( |╲ )
import { describe, expect, test } from "vitest";
import { exceedsInvitationShareLimit } from "./invitation-policy";

describe("presale invitation allocation policy", () => {
  test("allows a special invitation above the former 300-share ceiling", () => {
    expect(exceedsInvitationShareLimit(0, 500, 750)).toBe(false);
  });

  test("rejects requests that exceed the remaining invitation allocation", () => {
    expect(exceedsInvitationShareLimit(500, 251, 750)).toBe(true);
  });
});
