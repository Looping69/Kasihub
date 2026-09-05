// Author: Klaasvaakie ( |╲ )
import { describe, expect, it, vi } from "vitest";
import { CustodyProviderUnavailable, readRemitanoCustodyEvidence, evaluateCustodyEvidence, type CustodyEvidence, type CustodyExpectation } from "./custody";

const HASH = "a".repeat(64);
const expectation: CustodyExpectation = {
  provider: "remitano",
  network: "bsc",
  transactionHash: HASH,
  receiverAddress: `0x${"22".repeat(20)}`,
  currency: "USDT",
  expectedAmount: "25",
  tokenDecimals: 6,
};

function evidence(overrides: Partial<CustodyEvidence> = {}): CustodyEvidence {
  return {
    provider: "remitano",
    providerReference: "deposit-1",
    transactionHash: HASH,
    receiverAddress: expectation.receiverAddress,
    currency: "USDT",
    amount: "25.000000",
    outcome: "confirmed",
    observedAt: "2026-08-15T10:00:00.000Z",
    ...overrides,
  };
}

describe("custody reconciliation policy", () => {
  it("accepts an exact confirmed provider record", () => {
    expect(evaluateCustodyEvidence(expectation, evidence())).toMatchObject({
      decision: "confirmed",
      reason: "custody_evidence_satisfied",
    });
  });

  it.each([
    [{ provider: "other" }, "custody_provider_mismatch"],
    [{ receiverAddress: `0x${"33".repeat(20)}` }, "custody_receiver_mismatch"],
    [{ amount: "24.999999" }, "custody_amount_mismatch"],
    [{ currency: "USD" }, "custody_currency_mismatch"],
    [{ outcome: "reversed" as const }, "custody_reversed"],
  ])("routes contradictory evidence to manual review", (override, reason) => {
    expect(evaluateCustodyEvidence(expectation, evidence(override))).toMatchObject({
      decision: "manual_review",
      reason,
    });
  });

  it("keeps a pending custodian record retryable", () => {
    expect(evaluateCustodyEvidence(expectation, evidence({ outcome: "pending" }))).toMatchObject({
      decision: "retryable",
      reason: "custody_pending",
    });
  });
});

describe("Remitano authenticated deposit recovery", () => {
  const detail = { id: 123, tx_hash: `0x${HASH}`, coin_address: expectation.receiverAddress,
    coin_currency: "usdt", coin_amount: 25, status: "verified", verified_at_timestamp: 1788375440 };
  const history = { type: "deposit", id: 123, coin_address: expectation.receiverAddress, coin_currency: "usdt" };
  const invalidEndpoint = () => new CustodyProviderUnavailable("remitano", "custody_provider_http_400_invalid_endpoint");

  it("recovers the rejected hash endpoint through history and authoritative deposit details", async () => {
    const get = vi.fn().mockRejectedValueOnce(invalidEndpoint()).mockResolvedValueOnce([
      { ...history, type: "withdrawal", id: 124 },
      { ...history, coin_address: `0x${"33".repeat(20)}`, id: 125 }, history,
    ]).mockResolvedValueOnce(detail);
    const result = await readRemitanoCustodyEvidence(expectation, get);
    expect(get.mock.calls.map(([target]) => target)).toEqual([
      `/api/v1/coin_deposits/by_currency_and_tx_hash?coin_currency=usdt&tx_hash=0x${HASH}`,
      "/api/v2/coin_histories/latest_coin_deposits_and_withdrawals?coin_currency=usdt&limit=100",
      "/api/v1/coin_deposits/123",
    ]);
    expect(evaluateCustodyEvidence(expectation, result).decision).toBe("confirmed");
    expect(result.providerReference).toBe("123");
  });

  it("never confirms history alone or a different transaction", async () => {
    const get = vi.fn().mockRejectedValueOnce(invalidEndpoint()).mockResolvedValueOnce([history])
      .mockResolvedValueOnce({ ...detail, tx_hash: "b".repeat(64) });
    expect((await readRemitanoCustodyEvidence(expectation, get)).outcome).toBe("pending");
  });

  it.each([0, undefined, "invalid"])("requires completion evidence for verified status (%s)", async (timestamp) => {
    const get = vi.fn().mockResolvedValue([{ ...detail, verified_at_timestamp: timestamp }]);
    expect((await readRemitanoCustodyEvidence(expectation, get)).outcome).toBe("pending");
  });

  it.each([
    [{ coin_amount: 24 }, "custody_amount_mismatch"],
    [{ coin_address: `0x${"33".repeat(20)}` }, "custody_receiver_mismatch"],
    [{ coin_currency: "btc" }, "custody_currency_mismatch"],
    [{ status: "reversed" }, "custody_reversed"],
  ])("retains the custody gate on contradictory details", async (overrides, reason) => {
    const get = vi.fn().mockRejectedValueOnce(invalidEndpoint()).mockResolvedValueOnce([history])
      .mockResolvedValueOnce({ ...detail, ...overrides });
    expect(evaluateCustodyEvidence(expectation, await readRemitanoCustodyEvidence(expectation, get)))
      .toMatchObject({ decision: "manual_review", reason });
  });

  it("does not hide authentication errors with a fallback", async () => {
    const get = vi.fn().mockRejectedValue(new CustodyProviderUnavailable("remitano", "custody_provider_credentials_rejected"));
    await expect(readRemitanoCustodyEvidence(expectation, get)).rejects.toThrow("credentials_rejected");
    expect(get).toHaveBeenCalledTimes(1);
  });

  it("leaves detail outages retryable rather than accepting the history record", async () => {
    const get = vi.fn().mockRejectedValueOnce(invalidEndpoint()).mockResolvedValueOnce([history])
      .mockRejectedValueOnce(new CustodyProviderUnavailable("remitano", "custody_provider_network_unavailable"));
    await expect(readRemitanoCustodyEvidence(expectation, get)).rejects.toThrow("network_unavailable");
  });

  it("reports the bounded history window rather than hiding an older missing deposit", async () => {
    const get = vi.fn().mockRejectedValueOnce(invalidEndpoint()).mockResolvedValueOnce(
      Array.from({ length: 100 }, (_, id) => ({ ...history, id: id + 1, type: "withdrawal" })));
    await expect(readRemitanoCustodyEvidence(expectation, get)).rejects.toThrow("history_window_exhausted");
  });

  it.each([null, {}, { coin_deposits: {} }])("rejects malformed successful responses", async (payload) => {
    await expect(readRemitanoCustodyEvidence(expectation, vi.fn().mockResolvedValue(payload)))
      .rejects.toThrow("response_invalid_deposits");
  });
});
