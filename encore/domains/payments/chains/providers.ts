// Author: Klaasvaakie ( |╲ )
import { secret } from "encore.dev/config";
import { normalizeTransactionHash, transactionHashForRpc } from "./hash";
import type { ChainLog } from "./transfer";
import type { ChainTransactionEvidence } from "./types";

const bscRpcUrl = secret("BscRpcUrl");
const tronRpcBaseUrl = secret("TronRpcBaseUrl");
const tronRpcApiKey = secret("TronRpcApiKey");

export function validateBscProviderConfiguration(): void {
  const value = bscRpcUrl().trim();
  if (!value.startsWith("https://")) throw new Error("bsc_rpc_url_invalid");
}

export class ChainProviderUnavailable extends Error {
  constructor(public readonly network: "tron" | "bsc", message: string) {
    super(message);
    this.name = "ChainProviderUnavailable";
  }
}

function parseHexQuantity(value: string | null | undefined): bigint | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (!/^0x[0-9a-f]+$/.test(normalized)) return null;
  return BigInt(normalized);
}

async function fetchJson(url: string, init: RequestInit, network: "tron" | "bsc"): Promise<unknown> {
  try {
    const response = await fetch(url, { ...init, signal: AbortSignal.timeout(8_000) });
    if (!response.ok) throw new Error(`http_${response.status}`);
    return await response.json();
  } catch (error) {
    throw new ChainProviderUnavailable(network, error instanceof Error ? error.message : String(error));
  }
}

interface JsonRpcEnvelope<T> {
  jsonrpc?: string;
  id?: number;
  result?: T;
  error?: { code?: number; message?: string };
}

async function bscRpc<T>(method: string, params: unknown[]): Promise<T> {
  const body = await fetchJson(
    bscRpcUrl(),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    },
    "bsc",
  ) as JsonRpcEnvelope<T>;
  if (body.error) throw new ChainProviderUnavailable("bsc", `rpc_${body.error.code ?? "error"}:${body.error.message ?? "unknown"}`);
  return body.result as T;
}

interface EvmTransaction {
  hash?: string;
  from?: string;
  blockNumber?: string | null;
}

interface EvmReceipt {
  transactionHash?: string;
  blockNumber?: string;
  status?: string;
  logs?: Array<{ address?: string; topics?: string[]; data?: string }>;
}

interface EvmBlock { timestamp?: string }

export async function readBscTransactionEvidence(canonicalHash: string): Promise<ChainTransactionEvidence> {
  const transactionHash = normalizeTransactionHash(canonicalHash);
  const rpcHash = transactionHashForRpc("bsc", transactionHash);
  const [transaction, receipt] = await Promise.all([
    bscRpc<EvmTransaction | null>("eth_getTransactionByHash", [rpcHash]),
    bscRpc<EvmReceipt | null>("eth_getTransactionReceipt", [rpcHash]),
  ]);

  if (!transaction && !receipt) {
    return {
      network: "bsc",
      transactionHash,
      visible: false,
      execution: "pending",
      blockNumber: null,
      blockTimestamp: null,
      latestBlockNumber: null,
      sender: null,
      logs: [],
    };
  }
  if (!receipt) {
    return {
      network: "bsc",
      transactionHash,
      visible: true,
      execution: "pending",
      blockNumber: parseHexQuantity(transaction?.blockNumber),
      blockTimestamp: null,
      latestBlockNumber: null,
      sender: transaction?.from ?? null,
      logs: [],
    };
  }

  const receiptBlockNumber = parseHexQuantity(receipt.blockNumber);
  const [latestBlockRaw, minedBlock] = await Promise.all([
    bscRpc<string>("eth_blockNumber", []),
    receiptBlockNumber === null ? Promise.resolve(null) : bscRpc<EvmBlock | null>("eth_getBlockByNumber", [receipt.blockNumber, false]),
  ]);
  const latestBlock = parseHexQuantity(latestBlockRaw);
  const minedAtSeconds = parseHexQuantity(minedBlock?.timestamp);
  const execution = receipt.status?.toLowerCase() === "0x1" ? "success" : "failed";
  const logs: ChainLog[] = (receipt.logs ?? []).map((log) => ({
    address: log.address ?? "",
    topics: log.topics ?? [],
    data: log.data ?? "",
  }));

  return {
    network: "bsc",
    transactionHash: normalizeTransactionHash(receipt.transactionHash ?? transactionHash),
    visible: true,
    execution,
    blockNumber: receiptBlockNumber,
    blockTimestamp: minedAtSeconds === null ? null : new Date(Number(minedAtSeconds) * 1000).toISOString(),
    latestBlockNumber: latestBlock,
    sender: transaction?.from ?? null,
    logs,
  };
}

function tronUrl(path: string): string {
  return `${tronRpcBaseUrl().replace(/\/+$/, "")}${path}`;
}

/** Builds the authenticated TronGrid request header without exposing the key to callers. ( |╲ ) — Klaasvaakie */
export function tronRpcHeaders(apiKey: string): Record<string, string> {
  const normalized = apiKey.trim();
  if (!normalized) throw new Error("missing_tron_rpc_api_key");
  return { "Content-Type": "application/json", "TRON-PRO-API-KEY": normalized };
}

async function tronPost(path: string, body: unknown): Promise<Record<string, unknown>> {
  return await fetchJson(
    tronUrl(path),
    {
      method: "POST",
      headers: tronRpcHeaders(tronRpcApiKey()),
      body: JSON.stringify(body),
    },
    "tron",
  ) as Record<string, unknown>;
}

interface TronTransactionInfo {
  id?: string;
  blockNumber?: number;
  blockTimeStamp?: number;
  result?: string;
  receipt?: { result?: string };
  log?: Array<{ address?: string; topics?: string[]; data?: string }>;
}

interface TronTransaction {
  txID?: string;
  ret?: Array<{ contractRet?: string }>;
}

function tronObjectVisible(value: Record<string, unknown>): boolean {
  return Object.keys(value).length > 0;
}

function tronExecution(transaction: TronTransaction, info: TronTransactionInfo): "success" | "failed" | "pending" {
  const receiptResult = info.receipt?.result?.toUpperCase();
  const infoResult = info.result?.toUpperCase();
  const contractRet = transaction.ret?.[0]?.contractRet?.toUpperCase();
  if (receiptResult === "SUCCESS" || contractRet === "SUCCESS") return "success";
  if (receiptResult || infoResult === "FAILED" || (contractRet && contractRet !== "SUCCESS")) return "failed";
  return "pending";
}

export async function readTronTransactionEvidence(canonicalHash: string): Promise<ChainTransactionEvidence> {
  const transactionHash = normalizeTransactionHash(canonicalHash);
  const [transactionRaw, infoRaw] = await Promise.all([
    tronPost("/wallet/gettransactionbyid", { value: transactionHash }),
    tronPost("/wallet/gettransactioninfobyid", { value: transactionHash }),
  ]);
  const transaction = transactionRaw as TronTransaction;
  const info = infoRaw as TronTransactionInfo;
  const visible = tronObjectVisible(transactionRaw) || tronObjectVisible(infoRaw);
  if (!visible) {
    return {
      network: "tron",
      transactionHash,
      visible: false,
      execution: "pending",
      blockNumber: null,
      blockTimestamp: null,
      latestBlockNumber: null,
      sender: null,
      logs: [],
    };
  }

  let latestBlockNumber: bigint | null = null;
  if (info.blockNumber !== undefined) {
    const nowBlock = await tronPost("/wallet/getnowblock", {});
    const blockHeader = nowBlock.block_header as { raw_data?: { number?: number } } | undefined;
    if (blockHeader?.raw_data?.number !== undefined) latestBlockNumber = BigInt(blockHeader.raw_data.number);
  }

  const logs: ChainLog[] = (info.log ?? []).map((log) => ({
    address: log.address ?? "",
    topics: log.topics ?? [],
    data: log.data ?? "",
  }));

  return {
    network: "tron",
    transactionHash: normalizeTransactionHash(info.id ?? transaction.txID ?? transactionHash),
    visible: true,
    execution: tronExecution(transaction, info),
    blockNumber: info.blockNumber === undefined ? null : BigInt(info.blockNumber),
    blockTimestamp: info.blockTimeStamp === undefined ? null : new Date(info.blockTimeStamp).toISOString(),
    latestBlockNumber,
    sender: null,
    logs,
  };
}

export async function readChainTransactionEvidence(
  network: "tron" | "bsc",
  canonicalHash: string,
): Promise<ChainTransactionEvidence> {
  return network === "tron"
    ? readTronTransactionEvidence(canonicalHash)
    : readBscTransactionEvidence(canonicalHash);
}
