// Author: Klaasvaakie ( |╲ )

export type PresaleCampaignSaveInput = {
  priceUsd: number;
  startsAt?: string;
  endsAt?: string;
  tokenContract?: string;
  receivingAddress?: string;
  [key: string]: unknown;
};

export type PresaleCampaignAvailability = {
  status: string;
  startsAt?: string;
  endsAt?: string;
};

export function campaignAcceptsInvitations(campaign: PresaleCampaignAvailability, now = new Date()): boolean {
  if (campaign.status !== "active") return false;
  const currentTime = now.getTime();
  return (!campaign.startsAt || new Date(campaign.startsAt).getTime() <= currentTime)
    && (!campaign.endsAt || new Date(campaign.endsAt).getTime() > currentTime);
}

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
    tokenContract: draft.tokenContract?.trim() || undefined,
    receivingAddress: draft.receivingAddress?.trim() || undefined,
  };
}
