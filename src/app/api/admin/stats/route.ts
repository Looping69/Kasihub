// Author: Klaasvaakie ( |╲ )
import { NextResponse } from "next/server";
import { EncoreRequestError, encoreRequest, encoreSessionToken } from "@/lib/encore-client";

type Member = { id: string; createdAt: string; membershipType: string; subscriptionStatus: string; kycStatus: string; instapayStatus: string; profileNumber: string; firstName: string | null; lastName: string | null; companyName: string | null };
type Share = { quantity: number; totalAmount: number };
type Order = { amount: number };
type MallTransaction = { amount: number };
type Voucher = { value: number; status: string; expiryDate: string };
type Referral = { status: string; rewardAmount: number };
type Notification = { daysBefore: number };
type Phase = { id: string; phaseNumber: number; quantityAvailable: number; pricePerShare: string; status: string };
type Activity = { id: string; transactionType: string; profileId: string | null; amount: number; description: string; createdAt: string };

export async function GET() {
  const token = await encoreSessionToken();
  if (!token) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  try {
    const bundle = await encoreRequest<{
      members: { members: Member[] };
      shares: { shares: Share[] };
      roots: { pioneers: unknown[] };
      marketplace: { orders: Order[] };
      mall: { transactions: MallTransaction[]; silos: unknown[] };
      pool: { totals: { totalPaidOut: number; balance: number; totalIncoming: number } };
      vouchers: { vouchers: Voucher[] };
      referrals: { referrals: Referral[] };
      notifications: { notifications: Notification[] };
      phases: { phases: Phase[] };
      dividends: { dividends: unknown[] };
      activity: { transactions: Activity[] };
    }>("/admin/overview", {}, token);
    const memberData = bundle.members;
    const shareData = bundle.shares;
    const rootsData = bundle.roots;
    const marketData = bundle.marketplace;
    const mallData = bundle.mall;
    const poolData = bundle.pool;
    const voucherData = bundle.vouchers;
    const referralData = bundle.referrals;
    const notificationData = bundle.notifications;
    const phaseData = bundle.phases;
    const dividendData = bundle.dividends;
    const activityData = bundle.activity;
    const members = memberData.members;
    const now = Date.now();
    const activeVouchers = voucherData.vouchers.filter((voucher) => voucher.status === "ACTIVE" && new Date(voucher.expiryDate).getTime() > now);
    const registeredReferrals = referralData.referrals.filter((referral) => referral.status === "REGISTERED");
    const totalShares = shareData.shares.reduce((sum, share) => sum + share.quantity, 0);
    const shareRevenueUSD = shareData.shares.reduce((sum, share) => sum + share.totalAmount, 0);
    const mallRevenue = mallData.transactions.reduce((sum, transaction) => sum + transaction.amount, 0);
    const marketplaceRevenue = marketData.orders.reduce((sum, order) => sum + order.amount, 0);
    const subscriptionRevenue = 0;
    const memberGrowth = Array.from({ length: 14 }, (_, index) => {
      const date = new Date();
      date.setUTCDate(date.getUTCDate() - (13 - index));
      const key = date.toISOString().slice(0, 10);
      return { date: key, count: members.filter((member) => member.createdAt.slice(0, 10) === key).length };
    });
    let cumulative = Math.max(0, members.length - memberGrowth.reduce((sum, entry) => sum + entry.count, 0));
    const cumulativeGrowth = memberGrowth.map((entry) => ({ date: entry.date, count: cumulative += entry.count }));
    const phases = phaseData.phases.map((phase) => ({ id: phase.id, phase: phase.phaseNumber, pricePerShare: Number(phase.pricePerShare), totalShares: phase.quantityAvailable, soldShares: 0, status: phase.status === "active" ? "OPEN" : phase.status.toUpperCase(), bonusBuyOneGet: phase.phaseNumber === 1 }));
    const memberById = new Map(members.map((member) => [member.id, member]));
    const recentActivity = activityData.transactions.map((transaction) => {
      const member = transaction.profileId ? memberById.get(transaction.profileId) : undefined;
      return {
        id: transaction.id,
        type: transaction.transactionType,
        amount: transaction.amount,
        description: transaction.description,
        createdAt: transaction.createdAt,
        member: {
          profileNumber: member?.profileNumber ?? "SYSTEM",
          name: member?.companyName ?? ([member?.firstName, member?.lastName].filter(Boolean).join(" ") || "System"),
        },
      };
    });
    return NextResponse.json({
      totals: {
        members: members.length,
        activeMembers: members.filter((member) => member.subscriptionStatus === "ACTIVE").length,
        pendingKyc: members.filter((member) => member.kycStatus === "PENDING").length,
        totalShares,
        shareRevenueUSD,
        pioneerCount: rootsData.pioneers.length,
        pioneerTarget: 200,
        totalRevenue: subscriptionRevenue + shareRevenueUSD * 18.5 + mallRevenue + marketplaceRevenue,
        subscriptionRevenue,
        mallRevenue,
        marketplaceRevenue,
        poolPaidOut: poolData.totals.totalPaidOut,
        poolBalance: poolData.totals.balance,
        poolIncoming: poolData.totals.totalIncoming,
        mallTransactions: mallData.transactions.length,
        marketplaceOrders: marketData.orders.length,
        taxEligibleMembers: 0,
        totalVouchers: voucherData.vouchers.length,
        activeVouchers: activeVouchers.length,
        expiringVouchers: activeVouchers.filter((voucher) => new Date(voucher.expiryDate).getTime() <= now + 5 * 86400000).length,
        totalVoucherValue: activeVouchers.reduce((sum, voucher) => sum + voucher.value, 0),
        totalReferrals: referralData.referrals.length,
        registeredReferrals: registeredReferrals.length,
        referralConversionRate: referralData.referrals.length ? Number(((registeredReferrals.length / referralData.referrals.length) * 100).toFixed(1)) : 0,
        totalReferralRewards: registeredReferrals.reduce((sum, referral) => sum + referral.rewardAmount, 0),
        totalNotifications: notificationData.notifications.length,
        sent5Days: notificationData.notifications.filter((notification) => notification.daysBefore === 5).length,
        sent3Days: notificationData.notifications.filter((notification) => notification.daysBefore === 3).length,
        sent1Day: notificationData.notifications.filter((notification) => notification.daysBefore === 1).length,
        instapayVerifiedCount: members.filter((member) => member.instapayStatus === "VERIFIED").length,
        instapayPendingCount: members.filter((member) => member.instapayStatus === "PENDING").length,
      },
      memberGrowth,
      cumulativeGrowth,
      revenueBySource: [
        { name: "Subscriptions", value: subscriptionRevenue, color: "oklch(0.52 0.13 158)" },
        { name: "KasiShares", value: shareRevenueUSD * 18.5, color: "oklch(0.75 0.15 80)" },
        { name: "KasiMall", value: mallRevenue, color: "oklch(0.55 0.08 50)" },
        { name: "Marketplace", value: marketplaceRevenue, color: "oklch(0.65 0.18 145)" },
      ],
      typeBreakdown: {
        INDIVIDUAL_ADULT: members.filter((member) => member.membershipType === "INDIVIDUAL").length,
        INDIVIDUAL_KIDS: members.filter((member) => member.membershipType === "MINOR").length,
        COMPANY: members.filter((member) => member.membershipType === "COMPANY").length,
      },
      kycBreakdown: {
        VERIFIED: members.filter((member) => member.kycStatus === "VERIFIED").length,
        PENDING: members.filter((member) => member.kycStatus === "PENDING").length,
        REJECTED: members.filter((member) => member.kycStatus === "REJECTED").length,
      },
      silos: mallData.silos,
      phases,
      dividends: dividendData.dividends,
      recentActivity,
    });
  } catch (error) {
    const status = error instanceof EncoreRequestError ? error.status : 500;
    return NextResponse.json({ error: "Unable to aggregate Encore administration statistics" }, { status });
  }
}
