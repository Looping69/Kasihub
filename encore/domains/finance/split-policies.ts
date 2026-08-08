// Author: Klaasvaakie ( |╲ )
import type { FixedAllocationRule, SplitPolicy } from "./split-policy";

export const KASIHUB_CUSTODIAN = "KASIHUB_CUSTODIAN";

export const adultMembershipProfitPolicyV1: SplitPolicy = {
  key: "individual_adult_membership_profit",
  version: 1,
  status: "active",
  remainderRecipientType: KASIHUB_CUSTODIAN,
  rules: [
    { recipientType: KASIHUB_CUSTODIAN, basisPoints: 5900 },
    { recipientType: "KASIPIONEER_POOL", basisPoints: 100 },
    { recipientType: "PRIVATE_POOL", basisPoints: 100 },
    { recipientType: "NPO_POOL", basisPoints: 100 },
    { recipientType: "KASI_SHAREHOLDERS_POOL", basisPoints: 3800 },
  ],
};

export const merchantMembershipProfitPolicyV1: SplitPolicy = {
  key: "merchant_membership_profit",
  version: 1,
  status: "draft",
  remainderRecipientType: KASIHUB_CUSTODIAN,
  rules: adultMembershipProfitPolicyV1.rules,
};

export const npoMembershipProfitPolicyV1: SplitPolicy = {
  key: "npo_membership_profit",
  version: 1,
  status: "draft",
  remainderRecipientType: KASIHUB_CUSTODIAN,
  rules: adultMembershipProfitPolicyV1.rules,
};

export const npoNgoCampaignPolicyV1: SplitPolicy = {
  key: "npo_ngo_campaign",
  version: 1,
  status: "draft",
  remainderRecipientType: KASIHUB_CUSTODIAN,
  rules: [
    { recipientType: KASIHUB_CUSTODIAN, basisPoints: 4200 },
    { recipientType: "KASIPIONEER_POOL", basisPoints: 100 },
    { recipientType: "PRIVATE_POOL", basisPoints: 100 },
    { recipientType: "NPO_POOL", basisPoints: 100 },
    { recipientType: "KASI_SHAREHOLDERS_POOL", basisPoints: 2500 },
    { recipientType: "GROUP_REFERRER", basisPoints: 1500 },
    { recipientType: "REFERRER_NPO", basisPoints: 1500 },
  ],
};

export const marketplaceProductPolicyV1: SplitPolicy = {
  key: "marketplace_product",
  version: 1,
  status: "draft",
  remainderRecipientType: KASIHUB_CUSTODIAN,
  rules: [
    { recipientType: "MEMBER_CASHBACK", basisPoints: 1000 },
    { recipientType: KASIHUB_CUSTODIAN, basisPoints: 2700 },
    { recipientType: "KASIPIONEER_POOL", basisPoints: 100 },
    { recipientType: "PRIVATE_POOL", basisPoints: 100 },
    { recipientType: "NPO_POOL", basisPoints: 100 },
    { recipientType: "KASI_MARKETPLACE_POOL", basisPoints: 2500 },
    { recipientType: "KASI_SHAREHOLDERS_POOL", basisPoints: 2500 },
    { recipientType: "REFERRER", basisPoints: 1000 },
  ],
};

export const productCampaignGroupPolicyV1: SplitPolicy = {
  key: "product_campaign_group",
  version: 1,
  status: "draft",
  remainderRecipientType: KASIHUB_CUSTODIAN,
  rules: [
    { recipientType: "MEMBER_CASHBACK", basisPoints: 1000 },
    { recipientType: KASIHUB_CUSTODIAN, basisPoints: 2300 },
    { recipientType: "KASIPIONEER_POOL", basisPoints: 100 },
    { recipientType: "PRIVATE_POOL", basisPoints: 100 },
    { recipientType: "NPO_POOL", basisPoints: 100 },
    { recipientType: "KASI_MARKETPLACE_POOL", basisPoints: 2200 },
    { recipientType: "KASI_SHAREHOLDERS_POOL", basisPoints: 2200 },
    { recipientType: "CAMPAIGN_REFERRER", basisPoints: 1000 },
    { recipientType: "CAMPAIGN_MANAGER", basisPoints: 1000 },
  ],
};

export const ecosystemUplineR53V1: readonly FixedAllocationRule[] = [
  { recipientType: "UPLINE_LEVEL_1", cents: 1300 },
  { recipientType: "UPLINE_LEVEL_2", cents: 1100 },
  { recipientType: "UPLINE_LEVEL_3", cents: 1100 },
  { recipientType: "UPLINE_LEVEL_4", cents: 900 },
  { recipientType: "UPLINE_LEVEL_5", cents: 600 },
  { recipientType: "UPLINE_LEVEL_6", cents: 300 },
];

export const splitPolicies = [
  adultMembershipProfitPolicyV1,
  merchantMembershipProfitPolicyV1,
  npoMembershipProfitPolicyV1,
  npoNgoCampaignPolicyV1,
  marketplaceProductPolicyV1,
  productCampaignGroupPolicyV1,
] as const;
