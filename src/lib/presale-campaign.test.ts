// Author: Klaasvaakie ( |╲ )
import { describe, expect, test } from "vitest";
import { campaignSavePayload } from "./presale-campaign";

describe("presale campaign editor contract", () => {
  test("submits the visible USD share price and never substitutes a legacy USDT field", () => {
    const payload = campaignSavePayload({
      name: "Phase 1",
      priceUsd: 25,
      priceUsdt: 0,
      startsAt: "2026-08-12T10:00:00.000Z",
      endsAt: "",
    });

    expect(payload.priceUsd).toBe(25);
    expect(payload.priceUsdt).toBe(0);
    expect(payload.startsAt).toBe("2026-08-12T10:00:00.000Z");
    expect(payload.endsAt).toBeUndefined();
  });
});
