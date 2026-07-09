import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/admin/pool - KasiPool overview + distribution history
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "100");

    const [distributions, mallTx, marketplaceOrders] = await Promise.all([
      db.kasiPoolDistribution.findMany({
        orderBy: { payoutDate: "desc" },
        take: limit,
        include: { member: { select: { profileNumber: true, firstName: true, lastName: true, companyName: true } } },
      }),
      db.mallTransaction.findMany(),
      db.marketplaceOrder.findMany(),
    ]);

    // Pool incoming sources
    const mallPoolIncoming = mallTx.reduce((s, x) => s + x.kasiPool, 0);
    const marketplacePoolIncoming = marketplaceOrders.reduce((s, x) => s + x.commission, 0);

    // Source breakdown
    const sourceMap = new Map<string, number>();
    for (const d of distributions) {
      sourceMap.set(d.source, (sourceMap.get(d.source) || 0) + d.amount);
    }
    const sourceBreakdown = Array.from(sourceMap.entries()).map(([source, amount]) => ({
      source,
      amount: parseFloat(amount.toFixed(2)),
      count: distributions.filter((d) => d.source === source).length,
    }));

    const totalPaidOut = distributions.reduce((s, x) => s + x.amount, 0);
    const totalIncoming = mallPoolIncoming + marketplacePoolIncoming;
    const balance = totalIncoming - totalPaidOut;

    // Daily distribution trend (last 14 days)
    const now = new Date();
    const trendMap = new Map<string, number>();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      trendMap.set(d.toISOString().slice(0, 10), 0);
    }
    for (const d of distributions) {
      const key = new Date(d.payoutDate).toISOString().slice(0, 10);
      if (trendMap.has(key)) trendMap.set(key, (trendMap.get(key) || 0) + d.amount);
    }
    const dailyTrend = Array.from(trendMap.entries()).map(([date, amount]) => ({
      date,
      amount: parseFloat(amount.toFixed(2)),
    }));

    return NextResponse.json({
      distributions: distributions.map((d) => ({
        ...d,
        payoutDate: d.payoutDate.toISOString(),
        member: {
          profileNumber: d.member.profileNumber,
          name: d.member.companyName || `${d.member.firstName} ${d.member.lastName}`,
        },
      })),
      totals: {
        totalIncoming: parseFloat(totalIncoming.toFixed(2)),
        mallPoolIncoming: parseFloat(mallPoolIncoming.toFixed(2)),
        marketplacePoolIncoming: parseFloat(marketplacePoolIncoming.toFixed(2)),
        totalPaidOut: parseFloat(totalPaidOut.toFixed(2)),
        balance: parseFloat(balance.toFixed(2)),
        distributionCount: distributions.length,
      },
      sourceBreakdown,
      dailyTrend,
      eligibleMembers: await db.member.count({ where: { subscriptionStatus: "ACTIVE", isAdmin: false } }),
    });
  } catch (error) {
    console.error("[admin/pool] error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/admin/pool - trigger a manual pool distribution
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { totalAmount, source } = body;

    if (!totalAmount || totalAmount <= 0) {
      return NextResponse.json({ error: "A positive totalAmount is required" }, { status: 400 });
    }

    // Distribute equally among all active, non-admin members
    const eligibleMembers = await db.member.findMany({
      where: { subscriptionStatus: "ACTIVE", isAdmin: false },
    });

    if (eligibleMembers.length === 0) {
      return NextResponse.json({ error: "No eligible members" }, { status: 400 });
    }

    const perMember = parseFloat((totalAmount / eligibleMembers.length).toFixed(2));

    for (const m of eligibleMembers) {
      await db.kasiPoolDistribution.create({
        data: {
          memberId: m.id,
          amount: perMember,
          source: source || "MANUAL",
          status: "PAID",
        },
      });
      await db.transaction.create({
        data: {
          memberId: m.id,
          type: "POOL_PAYOUT",
          amount: perMember,
          description: `KasiPool manual distribution — ${source || "MANUAL"}`,
          status: "COMPLETED",
        },
      });
    }

    return NextResponse.json({
      distributed: eligibleMembers.length,
      perMember,
      totalDistributed: parseFloat(totalAmount.toFixed(2)),
    });
  } catch (error) {
    console.error("[admin/pool/trigger] error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
