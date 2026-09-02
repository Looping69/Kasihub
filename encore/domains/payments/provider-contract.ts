// Author: Klaasvaakie ( |\ )

export const PAYMENT_PROVIDERS = [
  "instapay_webpay_form",
  "instapay_payment_request",
  "remitano_gateway",
  "remitano_direct_usdt",
] as const;

export type PaymentProviderId =
  | "instapay_webpay_form"
  | "instapay_payment_request"
  | "remitano_gateway"
  | "remitano_direct_usdt";

export type ProviderCapability = {
  provider: PaymentProviderId;
  enabled: boolean;
  mode: "hosted_redirect" | "direct_transfer";
  reason?: string;
};
export const providerCapabilities: Record<PaymentProviderId, ProviderCapability> = {
  instapay_webpay_form: { provider: "instapay_webpay_form", enabled: true, mode: "hosted_redirect" },
  remitano_direct_usdt: { provider: "remitano_direct_usdt", enabled: true, mode: "direct_transfer" },
  instapay_payment_request: {
    provider: "instapay_payment_request", enabled: false, mode: "hosted_redirect",
    reason: "merchant_api_contract_not_configured",
  },
  remitano_gateway: {
    provider: "remitano_gateway", enabled: false, mode: "hosted_redirect",
    reason: "merchant_gateway_not_activated",
  },
};
