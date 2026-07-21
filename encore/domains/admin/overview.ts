// Author: Klaasvaakie ( |╲ )
import { api } from "encore.dev/api";
import { StructKeyspace, expireInSeconds } from "encore.dev/storage/cache";
import { applicationCache } from "../../resources";
import { requireAdminAccess } from "../auth/access";
import { adminMemberProfiles } from "./api";
import { adminShareCertificates, listSharePhases } from "../shares/api";
import { adminMarketplace, adminMall, adminRootsBank } from "../commerce/api";
import { adminDividends, poolOverview } from "../finance/api";
import { adminReferrals, adminSubscriptionNotifications, adminVouchers } from "../engagement/api";
import { listLedgerTransactions } from "../wallets/api";
import { cacheRead, cacheWrite } from "../shared/cache";

interface AdminOverviewBundle {
  members: { members: {
    id: string; profileNumber: string; membershipType: string; citizenshipType: string | null;
    firstName: string | null; lastName: string | null; companyName: string | null; email: string;
    country: string; mobile: string; kycStatus: string; kycVerifiedAt: string | null;
    subscriptionStatus: string; subscriptionAmount: number; subscriptionCurrency: string;
    monthlyEarnings: number; taxThreshold: boolean; nfcTagId: string; instapayStatus: string;
    instapayVerifiedAt: string | null; instapayAccountRef: string | null; uplineProfileNumber: string | null;
    uplineConfirmed: boolean; createdAt: string; shareCount: number; transactionCount: number; orderCount: number;
  }[]; total: number; limit: number; offset: number };
  shares: { shares: { id: string; profileId: string; phase: number; pricePerShare: number; quantity: number; totalAmount: number; certificateNo: string; status: string; createdAt: string }[] };
  roots: { pioneers: { id: string; profileId: string; category: string; sharePrice: number; membershipFee: number; totalAmount: number; paymentRef: string; pioneerPool: boolean; status: string; createdAt: string }[] };
  marketplace: { products: { id: string; name: string; description: string; category: string; provider: string; price: number; freePrice: number; currency: string; commissionPct: number; imageColor: string; rating: number; popular: boolean; createdAt: string; displayPrice?: number }[]; orders: { id: string; productId: string; productName: string; amount: number; commission: number; pricingTier: string; status: string; createdAt: string }[] };
  mall: { transactions: { id: string; nfcTagId: string; storeName: string; amount: number; costOfSale: number; vat: number; sharePool: number; kasiPool: number; status: string; createdAt: string }[]; silos: { id: string; name: string; percentage: number; description: string | null; color: string; sortOrder: number; updatedAt: string }[]; memberCount: number };
  pool: { distributions: { id: string; memberId: string; amount: number; source: string; poolType: string; status: string; payoutDate: string }[]; totals: { totalIncoming: number; mallPoolIncoming: number; marketplacePoolIncoming: number; totalPaidOut: number; balance: number; distributionCount: number }; eligibleMembers: number };
  vouchers: { vouchers: { id: string; memberId: string; code: string; title: string; description: string; provider: string; value: number; category: string; status: string; issueDate: string; expiryDate: string; anniversaryDate: string | null; wablastSent: boolean; expiringSent: boolean; createdAt: string }[] };
  referrals: { referrals: { id: string; referrerId: string; referredId: string | null; referralCode: string; referredName: string; referredEmail: string; referredMobile: string; status: string; rewardAmount: number; createdAt: string; convertedAt: string | null }[] };
  notifications: { notifications: { id: string; memberId: string; daysBefore: number; channel: string; status: string; message: string; sentAt: string }[]; activeMembers: number };
  phases: { phases: { id: string; phaseNumber: number; quantityAvailable: number; pricePerShare: string; currency: string; status: string; totalShares?: number; bonusBuyOneGet?: boolean; createdAt?: string; updatedAt?: string }[] };
  dividends: { dividends: { id: string; amount: number; totalShares: number; perShareAmount: number; status: string; declaredAt: string; paidAt: string | null }[] };
  activity: { transactions: { id: string; transactionType: string; referenceType: string; referenceId: string; description: string; createdAt: string; profileId: string | null; amount: number }[] };
}

const adminOverviewCache = new StructKeyspace<string, AdminOverviewBundle>(applicationCache, {
  keyPattern: "admin-overview/:key",
  defaultExpiry: expireInSeconds(15),
});

export const adminOverview = api<void, AdminOverviewBundle>(
  { method: "GET", path: "/admin/overview", expose: true },
  async () => {
    await requireAdminAccess();
    const cached = await cacheRead(adminOverviewCache, "bundle-v1");
    if (cached) return cached;

    const [members, shares, roots, marketplace, mall, pool, vouchers, referrals, notifications, phases, dividends, activity] = await Promise.all([
      adminMemberProfiles({ limit: 500 }),
      adminShareCertificates({ limit: 500 }),
      adminRootsBank(),
      adminMarketplace(),
      adminMall({ limit: 500 }),
      poolOverview({ limit: 500 }),
      adminVouchers(),
      adminReferrals(),
      adminSubscriptionNotifications(),
      listSharePhases(),
      adminDividends(),
      listLedgerTransactions(),
    ]);
    const response = { members, shares, roots, marketplace, mall, pool, vouchers, referrals, notifications, phases, dividends, activity };
    await cacheWrite(adminOverviewCache, "bundle-v1", response);
    return response;
  },
);
