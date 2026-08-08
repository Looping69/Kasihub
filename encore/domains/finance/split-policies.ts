// Author: Klaasvaakie ( |╲ )
import type { FixedSplitPolicy, SplitPolicy } from "./split-policy";

export const KASIHUB_CUSTODIAN = "KASIHUB_CUSTODIAN";
export const ZAR_MINOR_UNIT_SCALE = 2;
export const CUSTODIAN_REMAINDER_RULE = "custodian";

const adultProfitRules = [
  { code: CUSTODIAN_REMAINDER_RULE, recipientType: KASIHUB_CUSTODIAN, recipientMode: "system", basisPoints: 5900 },
  { code: "pioneer_pool", recipientType: "KASIPIONEER_POOL", recipientMode: "system", basisPoints: 100 },
  { code: "private_pool", recipientType: "PRIVATE_POOL", recipientMode: "system", basisPoints: 100 },
  { code: "npo_pool", recipientType: "NPO_POOL", recipientMode: "system", basisPoints: 100 },
  { code: "shareholders_pool", recipientType: "KASI_SHAREHOLDERS_POOL", recipientMode: "system", basisPoints: 3800 },
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
    { code: CUSTODIAN_REMAINDER_RULE, recipientType: KASIHUB_CUSTODIAN, recipientMode: "system", basisPoints: 4200 },
    { code: "pioneer_pool", recipientType: "KASIPIONEER_POOL", recipientMode: "system", basisPoints: 100 },
    { code: "private_pool", recipientType: "PRIVATE_POOL", recipientMode: "system", basisPoints: 100 },
    { code: "npo_pool", recipientType: "NPO_POOL", recipientMode: "system", basisPoints: 100 },
    { code: "shareholders_pool", recipientType: "KASI_SHAREHOLDERS_POOL", recipientMode: "system", basisPoints: 2500 },
    { code: "group_referrer", recipientType: "GROUP_REFERRER", recipientMode: "dynamic", basisPoints: 1500 },
    { code: "referrer_npo", recipientType: "REFERRER_NPO", recipientMode: "dynamic", basisPoints: 1500 },
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
    { code: "member_cashback", recipientType: "MEMBER_CASHBACK", recipientMode: "dynamic", basisPoints: 1000 },
    { code: CUSTODIAN_REMAINDER_RULE, recipientType: KASIHUB_CUSTODIAN, recipientMode: "system", basisPoints: 2700 },
    { code: "pioneer_pool", recipientType: "KASIPIONEER_POOL", recipientMode: "system", basisPoints: 100 },
    { code: "private_pool", recipientType: "PRIVATE_POOL", recipientMode: "system", basisPoints: 100 },
    { code: "npo_pool", recipientType: "NPO_POOL", recipientMode: "system", basisPoints: 100 },
    { code: "marketplace_pool", recipientType: "KASI_MARKETPLACE_POOL", recipientMode: "system", basisPoints: 2500 },
    { code: "shareholders_pool", recipientType: "KASI_SHAREHOLDERS_POOL", recipientMode: "system", basisPoints: 2500 },
    { code: "referrer", recipientType: "REFERRER", recipientMode: "dynamic", basisPoints: 1000 },
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
    { code: "member_cashback", recipientType: "MEMBER_CASHBACK", recipientMode: "dynamic", basisPoints: 1000 },
    { code: CUSTODIAN_REMAINDER_RULE, recipientType: KASIHUB_CUSTODIAN, recipientMode: "system", basisPoints: 2300 },
    { code: "pioneer_pool", recipientType: "KASIPIONEER_POOL", recipientMode: "system", basisPoints: 100 },
    { code: "private_pool", recipientType: "PRIVATE_POOL", recipientMode: "system", basisPoints: 100 },
    { code: "npo_pool", recipientType: "NPO_POOL", recipientMode: "system", basisPoints: 100 },
    { code: "marketplace_pool", recipientType: "KASI_MARKETPLACE_POOL", recipientMode: "system", basisPoints: 2200 },
    { code: "shareholders_pool", recipientType: "KASI_SHAREHOLDERS_POOL", recipientMode: "system", basisPoints: 2200 },
    { code: "campaign_referrer", recipientType: "CAMPAIGN_REFERRER", recipientMode: "dynamic", basisPoints: 1000 },
    { code: "campaign_manager", recipientType: "CAMPAIGN_MANAGER", recipientMode: "dynamic", basisPoints: 1000 },
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
    { code: "upline_level_1", recipientType: "UPLINE_LEVEL_1", recipientMode: "dynamic", amountMinor: 1300n, fallbackRecipientType: KASIHUB_CUSTODIAN },
    { code: "upline_level_2", recipientType: "UPLINE_LEVEL_2", recipientMode: "dynamic", amountMinor: 1100n, fallbackRecipientType: KASIHUB_CUSTODIAN },
    { code: "upline_level_3", recipientType: "UPLINE_LEVEL_3", recipientMode: "dynamic", amountMinor: 1100n, fallbackRecipientType: KASIHUB_CUSTODIAN },
    { code: "upline_level_4", recipientType: "UPLINE_LEVEL_4", recipientMode: "dynamic", amountMinor: 900n, fallbackRecipientType: KASIHUB_CUSTODIAN },
    { code: "upline_level_5", recipientType: "UPLINE_LEVEL_5", recipientMode: "dynamic", amountMinor: 600n, fallbackRecipientType: KASIHUB_CUSTODIAN },
    { code: "upline_level_6", recipientType: "UPLINE_LEVEL_6", recipientMode: "dynamic", amountMinor: 300n, fallbackRecipientType: KASIHUB_CUSTODIAN },
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
