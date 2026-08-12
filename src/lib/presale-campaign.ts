// Author: Klaasvaakie ( |╲ )

export type PresaleCampaignSaveInput = {
  priceUsd: number;
  startsAt?: string;
  endsAt?: string;
  [key: string]: unknown;
};

/**
 * Converts the campaign editor's local form values into the server contract.
 * The USD price is authoritative: USDT is quoted server-side at order creation.
 */
export function campaignSavePayload<T extends PresaleCampaignSaveInput>(draft: T): T & { startsAt?: string; endsAt?: string } {
  return {
    ...draft,
    priceUsd: draft.priceUsd,
    startsAt: draft.startsAt ? new Date(draft.startsAt).toISOString() : undefined,
    endsAt: draft.endsAt ? new Date(draft.endsAt).toISOString() : undefined,
  };
}
