// Author: Klaasvaakie ( |╲ )
import type { FixedSplitPolicy, SplitPolicy } from "./split-policy";

export const KASIHUB_CUSTODIAN = "KASIHUB_CUSTODIAN";
export const ZAR_MINOR_UNIT_SCALE = 2;
export const CUSTODIAN_REMAINDER_RULE = "custodian";

const adultProfitRules = [
  { code: CUSTODIAN_REMAINDER_RULE, recipientType: KASIHUB_CUSTODIAN, basisPoints: 5900 },
  { code: "pioneer_pool", recipientType: "KASIPIONEER_POOL", basisPoints: 100 },
  { code: "private_pool", recipientType: "PRIVATE_POOL", basisPoints: 100 },
  { code: "npo_pool", recipientType: "NPO_POOL", basisPoints: 100 },
  { code: "shareholders_pool", recipientType: "KASI_SHAREHOLDERS_POOL", basisPoints: 3800 },
] as const;

export const adultMembershipProfitPolicyV1: SplitPolicy = {
  key: "individual_adult_membership_profit",
  version: 1,
  status: "active",
  currency: "ZAR",
  minorUnitScale: ZAR_MINOR_UNIT_SCALE,
  remainderRuleCode: CUSTODIAN_REMAINDER_RULE,
  rules: adultProfitRules,
};

export const merchantMembershipProfitPolicyV1: SplitPolicy = {
  key: "merchant_membership_profit",
  version: 1,
  status: "draft",
  currency: "ZAR",
  minorUnitScale: ZAR_MINOR_UNIT_SCALE,
  remainderRuleCode: CUSTODIAN_REMAINDER_RULE,
  rules: adultProfitRules,
};

export const npoMembershipProfitPolicyV1: SplitPolicy = {
  key: "npo_membership_profit",
  version: 1,
  status: "draft",
  currency: "ZAR",
  minorUnitScale: ZAR_MINOR_UNIT_SCALE,
  remainderRuleCode: CUSTODIAN_REMAINDER_RULE,
  rules: adultProfitRules,
};

export const npoNgoCampaignPolicyV1: SplitPolicy = {
  key: "npo_ngo_campaign",
  version: 1,
  status: "draft",
  currency: "ZAR",
  minorUnitScale: ZAR_MINOR_UNIT_SCALE,
  remainderRuleCode: CUSTODIAN_REMAINDER_RULE,
  rules: [
    { code: CUSTODIAN_REMAINDER_RULE, recipientType: KASIHUB_CUSTODIAN, basisPoints: 4200 },
    { code: "pioneer_pool", recipientType: "KASIPIONEER_POOL", basisPoints: 100 },
    { code: "private_pool", recipientType: "PRIVATE_POOL", basisPoints: 100 },
    { code: "npo_pool", recipientType: "NPO_POOL", basisPoints: 100 },
    { code: "shareholders_pool", recipientType: "KASI_SHAREHOLDERS_POOL", basisPoints: 2500 },
    { code: "group_referrer", recipientType: "GROUP_REFERRER", basisPoints: 1500 },
    { code: "referrer_npo", recipientType: "REFERRER_NPO", basisPoints: 1500 },
  ],
};

export const marketplaceProductPolicyV1: SplitPolicy = {
  key: "marketplace_product",
  version: 1,
  status: "draft",
  currency: "ZAR",
  minorUnitScale: ZAR_MINOR_UNIT_SCALE,
  remainderRuleCode: CUSTODIAN_REMAINDER_RULE,
  rules: [
    { code: "member_cashback", recipientType: "MEMBER_CASHBACK", basisPoints: 1000 },
    { code: CUSTODIAN_REMAINDER_RULE, recipientType: KASIHUB_CUSTODIAN, basisPoints: 2700 },
    { code: "pioneer_pool", recipientType: "KASIPIONEER_POOL", basisPoints: 100 },
    { code: "private_pool", recipientType: "PRIVATE_POOL", basisPoints: 100 },
    { code: "npo_pool", recipientType: "NPO_POOL", basisPoints: 100 },
    { code: "marketplace_pool", recipientType: "KASI_MARKETPLACE_POOL", basisPoints: 2500 },
    { code: "shareholders_pool", recipientType: "KASI_SHAREHOLDERS_POOL", basisPoints: 2500 },
    { code: "referrer", recipientType: "REFERRER", basisPoints: 1000 },
  ],
};

export const productCampaignGroupPolicyV1: SplitPolicy = {
  key: "product_campaign_group",
  version: 1,
  status: "draft",
  currency: "ZAR",
  minorUnitScale: ZAR_MINOR_UNIT_SCALE,
  remainderRuleCode: CUSTODIAN_REMAINDER_RULE,
  rules: [
    { code: "member_cashback", recipientType: "MEMBER_CASHBACK", basisPoints: 1000 },
    { code: CUSTODIAN_REMAINDER_RULE, recipientType: KASIHUB_CUSTODIAN, basisPoints: 2300 },
    { code: "pioneer_pool", recipientType: "KASIPIONEER_POOL", basisPoints: 100 },
    { code: "private_pool", recipientType: "PRIVATE_POOL", basisPoints: 100 },
    { code: "npo_pool", recipientType: "NPO_POOL", basisPoints: 100 },
    { code: "marketplace_pool", recipientType: "KASI_MARKETPLACE_POOL", basisPoints: 2200 },
    { code: "shareholders_pool", recipientType: "KASI_SHAREHOLDERS_POOL", basisPoints: 2200 },
    { code: "campaign_referrer", recipientType: "CAMPAIGN_REFERRER", basisPoints: 1000 },
    { code: "campaign_manager", recipientType: "CAMPAIGN_MANAGER", basisPoints: 1000 },
  ],
};

export const ecosystemUplineR53PolicyV1: FixedSplitPolicy = {
  key: "ecosystem_upline_r53",
  version: 1,
  status: "approved",
  currency: "ZAR",
  minorUnitScale: ZAR_MINOR_UNIT_SCALE,
  expectedTotalMinor: 5300n,
  rules: [
    { code: "upline_level_1", recipientType: "UPLINE_LEVEL_1", amountMinor: 1300n, fallbackRecipientType: KASIHUB_CUSTODIAN },
    { code: "upline_level_2", recipientType: "UPLINE_LEVEL_2", amountMinor: 1100n, fallbackRecipientType: KASIHUB_CUSTODIAN },
    { code: "upline_level_3", recipientType: "UPLINE_LEVEL_3", amountMinor: 1100n, fallbackRecipientType: KASIHUB_CUSTODIAN },
    { code: "upline_level_4", recipientType: "UPLINE_LEVEL_4", amountMinor: 900n, fallbackRecipientType: KASIHUB_CUSTODIAN },
    { code: "upline_level_5", recipientType: "UPLINE_LEVEL_5", amountMinor: 600n, fallbackRecipientType: KASIHUB_CUSTODIAN },
    { code: "upline_level_6", recipientType: "UPLINE_LEVEL_6", amountMinor: 300n, fallbackRecipientType: KASIHUB_CUSTODIAN },
  ],
};

export const splitPolicies = [
  adultMembershipProfitPolicyV1,
  merchantMembershipProfitPolicyV1,
  npoMembershipProfitPolicyV1,
  npoNgoCampaignPolicyV1,
  marketplaceProductPolicyV1,
  productCampaignGroupPolicyV1,
] as const;
