// Development-only presale preview boundary. Author: Klaasvaakie ( |╲ )
export type PresaleDevPreviewOffer = {
  name: string;
  issuerName: string;
  shareClass: string;
  priceUsdt: string;
  priceUsd: string;
  usdtPerUsd: string;
  network: string;
  sharesRemaining: number;
  invitationSharesRemaining: number;
  minConfirmations: number;
  paymentWindowMinutes: number;
  termsVersion: string;
};

/**
 * Keeps the invitation bypass inside `next dev` only. Deployment builds set
 * NODE_ENV to production, so preview/staging/production cannot enable it.
 * Author: Klaasvaakie ( |╲ )
 */
export function isLocalPresalePreviewRequested(
  previewValue: string | undefined,
  nodeEnvironment = process.env.NODE_ENV,
): boolean {
  return nodeEnvironment === "development" && previewValue === "1";
}

/** Static display data only: no campaign, invitation, receiver, or token contract. Author: Klaasvaakie ( |╲ ) */
export const PRESALE_DEV_PREVIEW_OFFER: PresaleDevPreviewOffer = {
  name: "KaSiShares interface preview",
  issuerName: "KaSiHub (development only)",
  shareClass: "Class B shares",
  priceUsdt: "25.000000",
  priceUsd: "25.000000",
  usdtPerUsd: "1.000000",
  network: "No payment network",
  sharesRemaining: 100_000,
  invitationSharesRemaining: 750,
  minConfirmations: 0,
  paymentWindowMinutes: 0,
  termsVersion: "development-preview",
};
