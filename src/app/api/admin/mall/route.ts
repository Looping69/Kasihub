import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/admin/mall - all mall transactions across the platform
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "100");

    const [transactions, silos, mallThresholdSetting] = await Promise.all([
      db.mallTransaction.findMany({
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
      db.siloConfig.findMany({ orderBy: { sortOrder: "asc" } }),
      db.setting.findUnique({ where: { key: "mall_member_threshold" } }),
    ]);

    const totals = transactions.reduce(
      (acc, t) => {
        acc.amount += t.amount;
        acc.costOfSale += t.costOfSale;
        acc.vat += t.vat;
        acc.sharePool += t.sharePool;
        acc.kasiPool += t.kasiPool;
        return acc;
      },
      { amount: 0, costOfSale: 0, vat: 0, sharePool: 0, kasiPool: 0 }
    );

    // Store performance
    const storeMap = new Map<string, { revenue: number; count: number }>();
    for (const t of transactions) {
      const cur = storeMap.get(t.storeName) || { revenue: 0, count: 0 };
      cur.revenue += t.amount;
      cur.count += 1;
      storeMap.set(t.storeName, cur);
    }
    const storePerformance = Array.from(storeMap.entries())
      .map(([store, stats]) => ({ store, revenue: parseFloat(stats.revenue.toFixed(2)), count: stats.count }))
      .sort((a, b) => b.revenue - a.revenue);

    const memberCount = await db.member.count({ where: { isAdmin: false } });
    const mallThreshold = mallThresholdSetting ? parseInt(mallThresholdSetting.value) : 5000;

    return NextResponse.json({
      transactions: transactions.map((t) => ({ ...t, createdAt: t.createdAt.toISOString() })),
      silos: silos.map((s) => ({ ...s, updatedAt: s.updatedAt.toISOString() })),
      totals: {
        amount: parseFloat(totals.amount.toFixed(2)),
        costOfSale: parseFloat(totals.costOfSale.toFixed(2)),
        vat: parseFloat(totals.vat.toFixed(2)),
        sharePool: parseFloat(totals.sharePool.toFixed(2)),
        kasiPool: parseFloat(totals.kasiPool.toFixed(2)),
      },
      storePerformance,
      memberCount,
      mallThreshold,
      mallProgress: parseFloat(((memberCount / mallThreshold) * 100).toFixed(1)),
    });
  } catch (error) {
    console.error("[admin/mall] error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
