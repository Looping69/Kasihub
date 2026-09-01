const USDT_DECIMALS = 6;
const BSC_CHAIN_ID = 56;

export type CryptoPaymentRequest = {
  payload: string;
  networkLabel: string;
  includesExactAmount: boolean;
  guidance: string;
};

function usdtAtomicAmount(amount: string): bigint {
  const match = /^(\d+)(?:\.(\d{1,6}))?$/.exec(amount.trim());
  if (!match) throw new Error("USDT amount must use no more than six decimal places");
  const atomic = BigInt(match[1]) * BigInt(10) ** BigInt(USDT_DECIMALS)
    + BigInt((match[2] ?? "").padEnd(USDT_DECIMALS, "0"));
  if (atomic <= BigInt(0)) throw new Error("USDT amount must be greater than zero");
  return atomic;
}

function bscAddress(value: string, label: string): string {
  const address = value.trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) throw new Error(`${label} is not a valid BSC address`);
  return address;
}

function tronAddress(value: string): string {
  const address = value.trim();
  if (!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address)) throw new Error("Receiving address is not a valid TRON address");
  return address;
}

export function createCryptoPaymentRequest(input: {
  network: string;
  receivingAddress: string;
  tokenContract?: string;
  amountUsdt: string;
}): CryptoPaymentRequest {
  const network = input.network.trim().toLowerCase();
  if (network === "bsc") {
    const receiver = bscAddress(input.receivingAddress, "Receiving address");
    const tokenContract = bscAddress(input.tokenContract ?? "", "USDT token contract");
    const amount = usdtAtomicAmount(input.amountUsdt);
    return {
      payload: `ethereum:${tokenContract}@${BSC_CHAIN_ID}/transfer?address=${receiver}&uint256=${amount}`,
      networkLabel: "BNB Smart Chain (BEP20)",
      includesExactAmount: true,
      guidance: "Scanning requests the verified BEP20 USDT contract, receiving address, and exact reserved amount. Confirm every field in your wallet before sending.",
    };
  }

  if (network === "tron") {
    return {
      payload: tronAddress(input.receivingAddress),
      networkLabel: "TRON (TRC20)",
      includesExactAmount: false,
      guidance: "Scanning enters the verified receiving address only. Select TRC20 USDT and enter the exact reserved amount in your wallet before sending.",
    };
  }

  throw new Error("This payment network does not support a wallet QR request");
}
