// Author: Klaasvaakie ( |╲ )
import { secret } from "encore.dev/config";
import { createHash, createHmac } from "node:crypto";
import { normalizeChainAddress } from "./chains/address";
import { decimalToUnits } from "./chains/amount";
import { normalizeTransactionHash } from "./chains/hash";
import type { SupportedPaymentNetwork } from "./chains/types";
import { remitanoDepositRequestTarget } from "./remitano";

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

function remitanoOutcome(status: string): CustodyEvidence["outcome"] {
  const normalized = status.trim().toLowerCase();
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

export async function readRemitanoCustodyEvidence(expectation: CustodyExpectation): Promise<CustodyEvidence> {
  const payload = await remitanoGet(remitanoDepositRequestTarget(expectation));
  const rows = Array.isArray(payload) ? payload : payload && typeof payload === "object"
    ? ((payload as Record<string, unknown>).coin_deposits as unknown[] | undefined) ?? [] : [];
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
    outcome: remitanoOutcome(status),
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


