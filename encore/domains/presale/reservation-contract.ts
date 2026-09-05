// Author: Klaasvaakie ( |╲ )
import { issuedSharesForPresale } from "./settlement";

export type PresalePaymentRail = "remitano_usdt" | "webpay_card";

export type ReservationCancellationReason =
  | "unpaid_no_payment_activity"
  | "reservation_not_awaiting_payment"
  | "crypto_hash_submitted"
  | "card_checkout_started";

export interface ReservationCancellationPolicy {
  eligible: boolean;
  reason: ReservationCancellationReason;
}

export function deriveReservationCancellationPolicy(input: {
  status: string;
  transactionHash?: string | null;
  webPayTransactionId?: string | null;
}): ReservationCancellationPolicy {
  if (input.status !== "awaiting_payment") return { eligible: false, reason: "reservation_not_awaiting_payment" };
  if (input.transactionHash?.trim()) return { eligible: false, reason: "crypto_hash_submitted" };
  if (input.webPayTransactionId) return { eligible: false, reason: "card_checkout_started" };
  return { eligible: true, reason: "unpaid_no_payment_activity" };
}

export interface PresaleReservationContract {
  orderReference: string;
  phaseNumber: number;
  phaseLabel: string;
  campaignName: string;
  issuerName: string;
  shareClass: string;
  paidShares: number;
  bonusShares: number;
  totalAllocatedShares: number;
  paymentMethod: PresalePaymentRail;
  unitPriceUsd: string;
  totalUsd: string;
  unitPriceUsdt: string;
  totalUsdt: string;
  unitPriceZar?: string;
  totalZar?: string;
  network?: string;
  tokenContract?: string;
  receivingAddress?: string;
  requiredConfirmations?: number;
  receivedUsdt?: string;
  outstandingUsdt?: string;
  paymentDeadline: string;
  termsVersion: string;
  status: string;
  incorporationStatus: string;
  cancellation: ReservationCancellationPolicy;
}

export function buildPresaleReservationContract(input: {
  orderReference: string;
  phaseNumber: number;
  campaignName: string;
  issuerName: string;
  shareClass: string;
  paidShares: number;
  bonusBuyOneGetOne: boolean;
  paymentMethod: PresalePaymentRail;
  unitPriceUsd: string;
  totalUsd: string;
  unitPriceUsdt: string;
  totalUsdt: string;
  unitPriceZar?: string | null;
  totalZar?: string | null;
  network?: string | null;
  tokenContract?: string | null;
  receivingAddress?: string | null;
  requiredConfirmations?: number | null;
  receivedUsdt?: string;
  outstandingUsdt?: string;
  paymentDeadline: string;
  termsVersion: string;
  status: string;
  incorporationStatus: string;
  cancellation: ReservationCancellationPolicy;
}): PresaleReservationContract {
  const totalAllocatedShares = issuedSharesForPresale(input.paidShares, input.bonusBuyOneGetOne);
  return {
    orderReference: input.orderReference,
    phaseNumber: input.phaseNumber,
    phaseLabel: `Phase ${input.phaseNumber}`,
    campaignName: input.campaignName,
    issuerName: input.issuerName,
    shareClass: input.shareClass,
    paidShares: input.paidShares,
    bonusShares: totalAllocatedShares - input.paidShares,
    totalAllocatedShares,
    paymentMethod: input.paymentMethod,
    unitPriceUsd: input.unitPriceUsd,
    totalUsd: input.totalUsd,
    unitPriceUsdt: input.unitPriceUsdt,
    totalUsdt: input.totalUsdt,
    unitPriceZar: input.unitPriceZar ?? undefined,
    totalZar: input.totalZar ?? undefined,
    network: input.network ?? undefined,
    tokenContract: input.tokenContract ?? undefined,
    receivingAddress: input.receivingAddress ?? undefined,
    requiredConfirmations: input.requiredConfirmations ?? undefined,
    receivedUsdt: input.receivedUsdt,
    outstandingUsdt: input.outstandingUsdt,
    paymentDeadline: input.paymentDeadline,
    termsVersion: input.termsVersion,
    status: input.status,
    incorporationStatus: input.incorporationStatus,
    cancellation: input.cancellation,
  };
}
