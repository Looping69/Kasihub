// KaSiHUB shared types

export type MembershipType = "INDIVIDUAL_ADULT" | "INDIVIDUAL_KIDS" | "COMPANY";
export type KycStatus = "PENDING" | "VERIFIED" | "REJECTED";
export type SubscriptionStatus = "PENDING" | "ACTIVE" | "LAPSED";
export type ViewKey =
  | "dashboard"
  | "ecosystem"
  | "profile"
  | "shares"
  | "marketplace"
  | "mall"
  | "rootsbank";

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

export interface DashboardStats {
  member: Member;
  totalEarnings: number;
  monthlyEarnings: number;
  poolShareTotal: number;
  shareCount: number;
  shareValue: number;
  dailyDividend: number;
  matrixDownline: number;
  matrixLevels: number;
  pioneerPoolEligible: boolean;
  transactions: Transaction[];
  poolDistributions: KasiPoolDistribution[];
  earningsTrend: { date: string; amount: number }[];
  earningsBreakdown: { name: string; value: number; color: string }[];
}
