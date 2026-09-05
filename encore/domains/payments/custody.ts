// Author: Klaasvaakie ( |╲ )
import { secret } from "encore.dev/config";
import { createHash, createHmac } from "node:crypto";
import { normalizeChainAddress } from "./chains/address";
import { normalizeTransactionHash } from "./chains/hash";
import { remitanoDepositRequestTarget } from "./remitano";
import type { CustodyEvidence, CustodyExpectation } from "./custody-policy";

export {
  type CustodyEvidence,
  type CustodyExpectation,
  type CustodyDecision,
  evaluateCustodyEvidence,
} from "./custody-policy";

export class CustodyProviderUnavailable extends Error {
  constructor(public readonly provider: string, message: string) {
    super(message);
    this.name = "CustodyProviderUnavailable";
  }
}

export type CustodyEvidenceReader = (expectation: CustodyExpectation) => Promise<CustodyEvidence>;

const RemitanoApiKey = secret("REMITANO_API_KEY");
const RemitanoSecretKey = secret("REMITANO_SECRET_KEY");
const REMITANO_API_ORIGIN = "https://api.remitano.com";

type RemitanoDeposit = Record<string, unknown>;

function stringField(row: RemitanoDeposit, ...names: string[]): string {
  for (const name of names) {
    const value = row[name];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

function remitanoOutcome(status: string, row: RemitanoDeposit): CustodyEvidence["outcome"] {
  const normalized = status.trim().toLowerCase();
  // Remitano's credited deposit detail uses "verified" plus a completion time.
  const verifiedAt = Number(row.verified_at_timestamp);
  if (normalized === "verified" && Number.isFinite(verifiedAt) && verifiedAt > 0) return "confirmed";
  if (["completed", "confirmed", "success", "successful", "credited"].includes(normalized)) return "confirmed";
  if (["cancelled", "canceled", "reversed", "refunded", "failed", "rejected"].includes(normalized)) return "reversed";
  return "pending";
}

async function remitanoGet(requestTarget: string): Promise<unknown> {
  const body = "";
  const date = new Date().toUTCString();
  const contentMd5 = createHash("md5").update(body).digest("base64");
  const signatureInput = `GET,application/json,${contentMd5},${requestTarget},${date}`;
  const signature = createHmac("sha1", RemitanoSecretKey()).update(signatureInput).digest("base64");
  let response: Response;
  try {
    response = await fetch(`${REMITANO_API_ORIGIN}${requestTarget}`, {
      signal: AbortSignal.timeout(15_000),
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "Content-MD5": contentMd5,
        Date: date,
        Authorization: `APIAuth ${RemitanoApiKey()}:${signature}`,
      },
    });
  } catch {
    throw new CustodyProviderUnavailable("remitano", "custody_provider_network_unavailable");
  }
  const responseText = await response.text();
  if (response.status === 401 || response.status === 403) {
    throw new CustodyProviderUnavailable("remitano", "custody_provider_credentials_rejected");
  }
  if (!response.ok) {
    let providerReason = "unknown";
    try {
      const details = JSON.parse(responseText) as Record<string, unknown>;
      const candidate = details.error_code ?? details.error ?? details.message ?? details.code;
      if (typeof candidate === "string") providerReason = candidate.toLowerCase().replace(/[^a-z0-9_-]+/g, "_").slice(0, 80);
    } catch { /* non-JSON provider error */ }
    throw new CustodyProviderUnavailable("remitano", `custody_provider_http_${response.status}_${providerReason}`);
  }
  try { return JSON.parse(responseText); } catch {
    throw new CustodyProviderUnavailable("remitano", "custody_provider_response_invalid_json");
  }
}

export async function readRemitanoCustodyEvidence(
  expectation: CustodyExpectation,
  get: (target: string) => Promise<unknown> = remitanoGet,
): Promise<CustodyEvidence> {
  let payload: unknown;
  try {
    payload = await get(remitanoDepositRequestTarget(expectation));
  } catch (error) {
    if (!(error instanceof CustodyProviderUnavailable)
        || error.message !== "custody_provider_http_400_invalid_endpoint") throw error;
    // The published v1 hash route currently rejects valid authenticated calls.
    // v2 history supplies IDs only; fetch authoritative details and match the
    // full hash below. Never treat a history amount/address as payment proof.
    const query = new URLSearchParams({ coin_currency: expectation.currency.toLowerCase(), limit: "100" });
    const history = await get(`/api/v2/coin_histories/latest_coin_deposits_and_withdrawals?${query}`);
    if (!Array.isArray(history)) throw new CustodyProviderUnavailable("remitano", "custody_provider_response_invalid_history");
    const details: unknown[] = [];
    for (const item of history) {
      if (!item || typeof item !== "object") continue;
      const entry = item as RemitanoDeposit;
      if (entry.type !== "deposit" || stringField(entry, "coin_currency").toUpperCase() !== expectation.currency.toUpperCase()) continue;
      const address = stringField(entry, "coin_address");
      try {
        if (normalizeChainAddress(expectation.network, address) !== normalizeChainAddress(expectation.network, expectation.receiverAddress)) continue;
      } catch { continue; }
      const id = stringField(entry, "id");
      if (!/^[1-9][0-9]*$/.test(id)) throw new CustodyProviderUnavailable("remitano", "custody_provider_response_invalid_deposit_id");
      const detail = await get(`/api/v1/coin_deposits/${id}`);
      details.push(detail);
      if (detail && typeof detail === "object") {
        try {
          if (normalizeTransactionHash(stringField(detail as RemitanoDeposit, "tx_hash", "transaction_hash")) === normalizeTransactionHash(expectation.transactionHash)) break;
        } catch { /* Another deposit or malformed detail cannot establish custody. */ }
      }
    }
    // This API has no pagination. Report exhaustion explicitly so older deposits
    // cannot silently disappear behind a busy account's latest 100 records.
    if (history.length >= 100 && !details.some((detail) => {
      try { return normalizeTransactionHash(stringField(detail as RemitanoDeposit, "tx_hash", "transaction_hash")) === normalizeTransactionHash(expectation.transactionHash); } catch { return false; }
    })) throw new CustodyProviderUnavailable("remitano", "custody_provider_history_window_exhausted");
    payload = details;
  }
  const rows = Array.isArray(payload) ? payload : payload && typeof payload === "object"
    ? (payload as Record<string, unknown>).coin_deposits : undefined;
  if (!Array.isArray(rows)) throw new CustodyProviderUnavailable("remitano", "custody_provider_response_invalid_deposits");
  const expectedHash = normalizeTransactionHash(expectation.transactionHash);
  const row = rows.find((item) => {
    if (!item || typeof item !== "object") return false;
    const candidate = stringField(item as RemitanoDeposit, "tx_hash", "transaction_hash");
    if (!candidate) return false;
    try { return normalizeTransactionHash(candidate) === expectedHash; } catch { return false; }
  }) as RemitanoDeposit | undefined;
  if (!row) {
    return {
      provider: "remitano", providerReference: "not-yet-observed",
      transactionHash: expectation.transactionHash, receiverAddress: expectation.receiverAddress,
      currency: expectation.currency, amount: expectation.expectedAmount, outcome: "pending", observedAt: new Date().toISOString(),
    };
  }
  const receiverAddress = stringField(row, "receiver_address", "deposit_address", "coin_address", "address");
  const amount = stringField(row, "coin_amount", "amount", "credited_amount");
  const currency = stringField(row, "coin_currency", "currency");
  const status = stringField(row, "status", "state");
  if (!receiverAddress || !amount || !currency || !status) {
    throw new CustodyProviderUnavailable("remitano", "custody_provider_response_incomplete");
  }
  return {
    provider: "remitano",
    providerReference: stringField(row, "id", "ref", "reference") || "unknown",
    transactionHash: stringField(row, "tx_hash", "transaction_hash"),
    receiverAddress,
    currency,
    amount,
    outcome: remitanoOutcome(status, row),
    observedAt: new Date().toISOString(),
  };
}

/**
 * The default fails closed until a real provider adapter is installed. Tests
 * and provider modules inject a reader; product/browser code never supplies
 * custody truth. ( |╲ ) — Klaasvaakie
 */
export async function readCustodyEvidence(expectation: CustodyExpectation): Promise<CustodyEvidence> {
  if (expectation.provider.toLowerCase() === "remitano") return readRemitanoCustodyEvidence(expectation);
  throw new CustodyProviderUnavailable(expectation.provider, "custody_adapter_not_configured");
}


