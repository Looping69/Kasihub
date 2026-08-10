// KaSiHUB shared types

export type MembershipType =
  | "INDIVIDUAL_ADULT"
  | "INDIVIDUAL_KIDS"
  | "COMPANY"
  | "SOLE_PROPRIETOR"
  | "NPO_NGO"
  | "FREE";

export type CitizenshipType =
  | "SA_CITIZEN_SA"
  | "FOREIGN_CITIZEN_SA"
  | "SA_CIPC_COMPANY"
  | "SA_SOLE_PROPRIETOR"
  | "SA_NPO_NGO"
  | "SA_CITIZEN_ABROAD"
  | "FOREIGN_CITIZEN_ABROAD"
  | "INTL_COMPANY";
export type KycStatus = "PENDING" | "VERIFIED" | "REJECTED";
export type SubscriptionStatus = "PENDING" | "ACTIVE" | "LAPSED";
export type ViewKey =
  | "dashboard"
  | "ecosystem"
  | "profile"
  | "shares"
  | "marketplace"
  | "mall"
  | "rootsbank"
  | "legal"
  | "vouchers"
  | "refer";

export interface Member {
  id: string;
  profileNumber: string;
  membershipType: MembershipType;
  firstName: string | null;
  lastName: string | null;
  companyName: string | null;
  companyRegNo: string | null;
  idPassport: string | null;
  sarsNumber: string | null;
  email: string;
  country: string;
  mobile: string;
  addressLine: string | null;
  city: string | null;
  postalCode: string | null;
  profilePicture: string | null;
  beneficiaryName: string | null;
  beneficiaryId: string | null;
  guardianName: string | null;
  kycStatus: KycStatus;
  kycVerifiedAt: string | null;
  subscriptionStatus: SubscriptionStatus;
  subscriptionAmount: number;
  subscriptionCurrency: string;
  paymentMethod: string | null;
  taxThreshold: boolean;
  monthlyEarnings: number;
  nfcTagId: string | null;
  visaCardLast4: string | null;
  rootsBankAccount: string | null;
  citizenshipType: string | null;
  instapayStatus: string;
  instapayVerifiedAt: string | null;
  instapayAccountRef: string | null;
  uplineProfileNumber: string | null;
  uplineConfirmed: boolean;
  isAdmin: boolean;
  createdAt: string;
}

export interface MatrixNode {
  id: string;
  memberId: string;
  parentId: string | null;
  level: number;
  position: number;
  nodeIndex: number;
  sponsorId: string | null;
  member: {
    profileNumber: string;
    firstName: string | null;
    lastName: string | null;
    companyName: string | null;
    membershipType: string;
    country: string;
  };
}

export interface Share {
  id: string;
  phase: number;
  pricePerShare: number;
  quantity: number;
  totalAmount: number;
  certificateNo: string;
  prevCertificateNo: string | null;
  status: string;
  createdAt: string;
  isLegacy?: boolean;
  currentValuePerShare?: number;
  currentTotalValue?: number;
}

export interface SharePhase {
  id: string;
  phase: number;
  pricePerShare: number;
  totalShares: number;
  soldShares: number;
  status: string;
  bonusBuyOneGet: boolean;
}

export interface AureusShare {
  id: string;
  phase: number;
  pricePerShare: number;
  quantity: number;
  totalAmount: number;
  certificateNo: string;
  prevCertificateNo: string | null;
  status: string;
  createdAt: string;
}

export interface Transaction {
  id: string;
  type: string;
  amount: number;
  description: string;
  status: string;
  createdAt: string;
}

export interface KasiPoolDistribution {
  id: string;
  amount: number;
  source: string;
  payoutDate: string;
  status: string;
}

export interface MarketplaceProduct {
  id: string;
  name: string;
  description: string;
  category: string;
  provider: string;
  price: number;
  currency: string;
  commissionPct: number;
  imageColor: string;
  rating: number;
  popular: boolean;
}

export interface MarketplaceOrder {
  id: string;
  productId: string;
  productName: string;
  amount: number;
  commission: number;
  status: string;
  createdAt: string;
}

export interface MallTransaction {
  id: string;
  nfcTagId: string;
  storeName: string;
  amount: number;
  costOfSale: number;
  vat: number;
  sharePool: number;
  kasiPool: number;
  status: string;
  createdAt: string;
}

export interface RootsBankShare {
  id: string;
  category: string;
  sharePrice: number;
  membershipFee: number;
  totalAmount: number;
  paymentRef: string | null;
  pioneerPool: boolean;
  status: string;
  createdAt: string;
}

export interface Subscription {
  id: string;
  amount: number;
  currency: string;
  method: string;
  status: string;
  period: string;
  createdAt: string;
}

export interface PoolDistribution {
  id: string;
  amount: number;
  source: string;
  payoutDate: string;
  status: string;
  poolType?: string;
}

export interface DashboardStats {
  member: Member;
  walletBalance: number;
  walletCurrency: string;
  totalEarnings: number;
  monthlyEarnings: number;
  earningsToday: number;
  earningsThisWeek: number;
  earningsThisMonth: number;
  ecosystemEarningsToday: number;
  pools: {
    pioneer: {
      total: number;
      today: number;
      eligible: boolean;
      distributions: PoolDistribution[];
    };
    marketplace: {
      total: number;
      today: number;
      distributions: PoolDistribution[];
    };
    shareholders: {
      total: number;
      today: number;
      eligible: boolean;
      distributions: PoolDistribution[];
    };
  };
  kasiShares: {
    count: number;
    valuePerShare: number;
    totalValue: number;
  };
  aureusShares: {
    count: number;
    valuePerShare: number;
    totalValue: number;
  };
  rootsBankShares: {
    count: number;
    totalValue: number;
  };
  ecosystemDownline: number;
  ecosystemLevels: number;
  pioneerPoolEligible: boolean;
  auditorNotified: boolean;
  transactions: Transaction[];
  poolDistributions: PoolDistribution[];
  totalEarningsTrend: { date: string; amount: number }[];
  earningsBreakdown: { name: string; value: number; color: string }[];
}
