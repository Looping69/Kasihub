// Author: Klaasvaakie ( |╲ )
import { describe, expect, test } from "vitest";
import { campaignAcceptsInvitations, campaignSavePayload } from "./presale-campaign";

describe("presale campaign editor contract", () => {
  test("submits the visible USD share price and never substitutes a legacy USDT field", () => {
    const payload = campaignSavePayload({
      name: "Phase 1",
      priceUsd: 25,
      priceUsdt: 0,
      startsAt: "2026-08-12T10:00:00.000Z",
      endsAt: "",
      tokenContract: "  ",
      receivingAddress: "",
    });

    expect(payload.priceUsd).toBe(25);
    expect(payload.priceUsdt).toBe(0);
    expect(payload.startsAt).toBe("2026-08-12T10:00:00.000Z");
    expect(payload.endsAt).toBeUndefined();
    expect(payload.tokenContract).toBeUndefined();
    expect(payload.receivingAddress).toBeUndefined();
  });

  test("only offers invitations while an active campaign is inside its configured window", () => {
    const now = new Date("2026-08-31T07:00:00.000Z");
    expect(campaignAcceptsInvitations({ status: "active" }, now)).toBe(true);
    expect(campaignAcceptsInvitations({ status: "active", startsAt: "2026-08-31T08:00:00.000Z" }, now)).toBe(false);
    expect(campaignAcceptsInvitations({ status: "active", endsAt: "2026-08-31T06:00:00.000Z" }, now)).toBe(false);
    expect(campaignAcceptsInvitations({ status: "paused" }, now)).toBe(false);
  });
});
