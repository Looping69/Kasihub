import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/admin/stats - platform-wide admin overview stats
export async function GET() {
  try {
    const [
      totalMembers, activeMembers, pendingKyc, totalShares, totalShareValue,
      pioneerCount, totalSubscriptions, totalTransactions, totalMallTx,
      totalMarketplaceOrders, poolDistributions, dividendDeclarations,
      silos, phases, allMembers,
    ] = await Promise.all([
      db.member.count({ where: { isAdmin: false } }),
      db.member.count({ where: { subscriptionStatus: "ACTIVE", isAdmin: false } }),
      db.member.count({ where: { kycStatus: "PENDING", isAdmin: false } }),
      db.share.aggregate({ where: { status: "ACTIVE" }, _sum: { quantity: true, totalAmount: true } }),
      db.share.aggregate({ where: { status: "ACTIVE" }, _sum: { totalAmount: true } }),
      db.rootsBankShare.count(),
      db.subscription.findMany({ where: { status: "PAID" } }),
      db.transaction.findMany(),
      db.mallTransaction.findMany(),
      db.marketplaceOrder.findMany(),
      db.kasiPoolDistribution.findMany(),
      db.dividendDeclaration.findMany({ orderBy: { declaredAt: "desc" } }),
      db.siloConfig.findMany({ orderBy: { sortOrder: "asc" } }),
      db.sharePhase.findMany({ orderBy: { phase: "asc" } }),
      db.member.findMany({
        where: { isAdmin: false },
        orderBy: { createdAt: "asc" },
        select: { id: true, createdAt: true, subscriptionStatus: true, kycStatus: true, membershipType: true, monthlyEarnings: true },
      }),
    ]);

    // Revenue calculations
    const subscriptionRevenue = totalSubscriptions.reduce((s, x) => {
      if (x.currency === "USD") return s + x.amount * 18.5; // approx ZAR
      return s + x.amount;
    }, 0);
    const shareRevenueUSD = totalShareValue._sum.totalAmount || 0;
    const shareRevenueZAR = shareRevenueUSD * 18.5;
    const mallRevenue = totalMallTx.reduce((s, x) => s + x.amount, 0);
    const marketplaceRevenue = totalMarketplaceOrders.reduce((s, x) => s + x.amount, 0);
    const poolPaidOut = poolDistributions.reduce((s, x) => s + x.amount, 0);
    const totalRevenue = subscriptionRevenue + shareRevenueZAR + mallRevenue + marketplaceRevenue;

    // Member growth (last 14 days)
    const now = new Date();
    const growthMap = new Map<string, number>();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      growthMap.set(d.toISOString().slice(0, 10), 0);
    }
    for (const m of allMembers) {
      const key = new Date(m.createdAt).toISOString().slice(0, 10);
      if (growthMap.has(key)) growthMap.set(key, (growthMap.get(key) || 0) + 1);
    }
    const memberGrowth = Array.from(growthMap.entries()).map(([date, count]) => ({ date, count }));

    // Cumulative growth
    let cumulative = 0;
    const cumulativeGrowth = memberGrowth.map((g) => {
      cumulative += g.count;
      return { date: g.date, count: cumulative };
    });

    // Revenue by source (for pie chart)
    const revenueBySource = [
      { name: "Subscriptions", value: parseFloat(subscriptionRevenue.toFixed(2)), color: "oklch(0.52 0.13 158)" },
      { name: "KasiShares", value: parseFloat(shareRevenueZAR.toFixed(2)), color: "oklch(0.75 0.15 80)" },
      { name: "KasiMall", value: parseFloat(mallRevenue.toFixed(2)), color: "oklch(0.55 0.08 50)" },
      { name: "Marketplace", value: parseFloat(marketplaceRevenue.toFixed(2)), color: "oklch(0.65 0.18 145)" },
    ];

    // Membership type breakdown
    const typeBreakdown = {
      INDIVIDUAL_ADULT: allMembers.filter((m) => m.membershipType === "INDIVIDUAL_ADULT").length,
      INDIVIDUAL_KIDS: allMembers.filter((m) => m.membershipType === "INDIVIDUAL_KIDS").length,
      COMPANY: allMembers.filter((m) => m.membershipType === "COMPANY").length,
    };

    // Kyc breakdown
    const kycBreakdown = {
      VERIFIED: allMembers.filter((m) => m.kycStatus === "VERIFIED").length,
      PENDING: allMembers.filter((m) => m.kycStatus === "PENDING").length,
      REJECTED: allMembers.filter((m) => m.kycStatus === "REJECTED").length,
    };

    // Tax threshold members
    const taxEligibleMembers = allMembers.filter((m) => m.monthlyEarnings > 7000).length;

    // Pool balance (incoming - paid out)
    const poolIncoming = totalMallTx.reduce((s, x) => s + x.kasiPool, 0) +
      totalMarketplaceOrders.reduce((s, x) => s + x.commission, 0);
    const poolBalance = poolIncoming - poolPaidOut;

    // Recent activity (last 20 transactions across platform)
    const recentActivity = await db.transaction.findMany({
      take: 20,
      orderBy: { createdAt: "desc" },
      include: { member: { select: { profileNumber: true, firstName: true, lastName: true, companyName: true } } },
    });

    return NextResponse.json({
      totals: {
        members: totalMembers,
        activeMembers,
        pendingKyc,
        totalShares: totalShares._sum.quantity || 0,
        shareRevenueUSD: parseFloat(shareRevenueUSD.toFixed(2)),
        pioneerCount,
        pioneerTarget: 200,
        totalRevenue: parseFloat(totalRevenue.toFixed(2)),
        subscriptionRevenue: parseFloat(subscriptionRevenue.toFixed(2)),
        mallRevenue: parseFloat(mallRevenue.toFixed(2)),
        marketplaceRevenue: parseFloat(marketplaceRevenue.toFixed(2)),
        poolPaidOut: parseFloat(poolPaidOut.toFixed(2)),
        poolBalance: parseFloat(poolBalance.toFixed(2)),
        poolIncoming: parseFloat(poolIncoming.toFixed(2)),
        mallTransactions: totalMallTx.length,
        marketplaceOrders: totalMarketplaceOrders.length,
        taxEligibleMembers,
      },
      memberGrowth,
      cumulativeGrowth,
      revenueBySource,
      typeBreakdown,
      kycBreakdown,
      silos: silos.map((s) => ({ ...s, updatedAt: s.updatedAt.toISOString() })),
      phases: phases.map((p) => ({ ...p, createdAt: p.createdAt.toISOString(), updatedAt: p.updatedAt.toISOString() })),
      dividends: dividendDeclarations.map((d) => ({
        ...d,
        declaredAt: d.declaredAt.toISOString(),
        paidAt: d.paidAt?.toISOString() || null,
      })),
      recentActivity: recentActivity.map((t) => ({
        ...t,
        createdAt: t.createdAt.toISOString(),
        member: {
          profileNumber: t.member.profileNumber,
          name: t.member.companyName || `${t.member.firstName} ${t.member.lastName}`,
        },
      })),
    });
  } catch (error) {
    console.error("[admin/stats] error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
