// Author: Klaasvaakie ( |╲ )
import { describe, expect, test } from "vitest";
import { privatePresaleInviteUrl } from "./presale-links";

describe("private presale links", () => {
  test("uses the canonical shares hostname and safely encodes the invitation", () => {
    expect(privatePresaleInviteUrl("invite /?token")).toBe(
      "https://shares.kasihub.net/?invite=invite+%2F%3Ftoken",
    );
  });
});
