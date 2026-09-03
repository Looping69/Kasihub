import type { PresalePaymentRail } from "./webpay";

export type AuthoritativePaymentMethod = {
  id: PresalePaymentRail;
  label: string;
  currency: "USDT" | "ZAR";
  unitPrice: string;
  pricingMode: "campaign" | "invitation_override" | "bounded_test";
  enabled: boolean;
  unavailableReason?: string;
};

export function authoritativePaymentMethods(input: {
  network: string;
  tokenContract: string | null;
  receivingAddress: string | null;
  campaignUnitPriceUsdt: string;
  cryptoUnitPriceUsdt: string;
  webPayUnitPriceZar: string;
  webPayConfigured: boolean;
  invitationWebPayOverride: boolean;
}): AuthoritativePaymentMethod[] {
  const cryptoEnabled = input.network === "bsc" && Boolean(input.tokenContract?.trim() && input.receivingAddress?.trim());
  return [
    {
      id: "remitano_usdt",
      label: "International payment — Remitano USDT",
      currency: "USDT",
      unitPrice: input.cryptoUnitPriceUsdt,
      pricingMode: input.cryptoUnitPriceUsdt === input.campaignUnitPriceUsdt ? "campaign" : "bounded_test",
      enabled: cryptoEnabled,
      unavailableReason: cryptoEnabled ? undefined : "The controlled USDT receiving route is unavailable",
    },
    {
      id: "webpay_card",
      label: "Debit or credit card — WebPay",
      currency: "ZAR",
      unitPrice: input.webPayUnitPriceZar,
      pricingMode: input.invitationWebPayOverride ? "invitation_override" : "campaign",
      enabled: input.webPayConfigured,
      unavailableReason: input.webPayConfigured ? undefined : "WebPay checkout is not configured",
    },
  ];
}

export function paymentRailAvailability(methods: AuthoritativePaymentMethod[], rail: PresalePaymentRail): { allowed: true } | { allowed: false; reason: string } {
  const method = methods.find((candidate) => candidate.id === rail);
  return method?.enabled
    ? { allowed: true }
    : { allowed: false, reason: method?.unavailableReason ?? "The selected payment method is unavailable" };
}
