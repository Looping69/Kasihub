import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/shares?memberId=xxx - get member's shares + all phases
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const memberId = searchParams.get("memberId");

    const phases = await db.sharePhase.findMany({ orderBy: { phase: "asc" } });

    if (!memberId) {
      return NextResponse.json({ phases, shares: [], totalShares: 0, totalValue: 0 });
    }

    const shares = await db.share.findMany({
      where: { memberId, status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
    });

    const totalShares = shares.reduce((s, x) => s + x.quantity, 0);
    const totalValue = shares.reduce((s, x) => s + x.totalAmount, 0);

    // Calculate dividends (simulated): daily share of KasiMall profits
    // Assume daily profit pool of $2000 distributed among all sold shares
    const allSharesCount = await db.share.aggregate({
      where: { status: "ACTIVE" },
      _sum: { quantity: true },
    });
    const totalSharesOutstanding = allSharesCount._sum.quantity || 1;
    const dailyProfitPool = 2000; // USD simulated
    const dailyDividendPerShare = dailyProfitPool / totalSharesOutstanding;
    const myDailyDividend = totalShares * dailyDividendPerShare;

    return NextResponse.json({
      phases,
      shares: shares.map((s) => ({ ...s, createdAt: s.createdAt.toISOString() })),
      totalShares,
      totalValue: parseFloat(totalValue.toFixed(2)),
      dailyDividendPerShare: parseFloat(dailyDividendPerShare.toFixed(4)),
      myDailyDividend: parseFloat(myDailyDividend.toFixed(2)),
      totalSharesOutstanding,
    });
  } catch (error) {
    console.error("[shares] error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
