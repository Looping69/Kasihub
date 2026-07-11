import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/shares?memberId=xxx - get member's shares (active + retracted) + all phases + Aureus shares
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const memberId = searchParams.get("memberId");

    const phases = await db.sharePhase.findMany({ orderBy: { phase: "asc" } });

    // Fetch share value from settings
    const shareValueSetting = await db.setting.findUnique({ where: { key: "kasi_share_current_value_usd" } });
    const aureusValueSetting = await db.setting.findUnique({ where: { key: "aureus_share_current_value_usd" } });
    const shareValuePerShare = shareValueSetting ? parseFloat(shareValueSetting.value) : 39.95;
    const aureusValuePerShare = aureusValueSetting ? parseFloat(aureusValueSetting.value) : 15.00;

    if (!memberId) {
      return NextResponse.json({
        phases, activeShares: [], retractedShares: [], aureusShares: [], retractedAureusShares: [],
        totalShares: 0, totalValue: 0, shareValuePerShare, aureusValuePerShare,
      });
    }

    // Active KasiShares
    const activeShares = await db.share.findMany({
      where: { memberId, status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
    });
    // Retracted/Revoked KasiShares
    const retractedShares = await db.share.findMany({
      where: { memberId, status: "REVOKED" },
      orderBy: { createdAt: "desc" },
    });

    // Active Aureus shares
    const aureusShares = await db.aureusShare.findMany({
      where: { memberId, status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
    });
    // Retracted Aureus shares
    const retractedAureusShares = await db.aureusShare.findMany({
      where: { memberId, status: "RETRACTED" },
      orderBy: { createdAt: "desc" },
    });

    const totalShares = activeShares.reduce((s, x) => s + x.quantity, 0);
    // Value = current share value × total shares (NOT purchase price)
    const totalValue = totalShares * shareValuePerShare;

    // Calculate dividends (simulated): daily share of KasiMall profits
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
      activeShares: activeShares.map((s) => ({ ...s, createdAt: s.createdAt.toISOString() })),
      retractedShares: retractedShares.map((s) => ({ ...s, createdAt: s.createdAt.toISOString() })),
      aureusShares: aureusShares.map((s) => ({ ...s, createdAt: s.createdAt.toISOString() })),
      retractedAureusShares: retractedAureusShares.map((s) => ({ ...s, createdAt: s.createdAt.toISOString() })),
      totalShares,
      totalValue: parseFloat(totalValue.toFixed(2)),
      shareValuePerShare,
      aureusValuePerShare,
      aureusTotalShares: aureusShares.reduce((s, x) => s + x.quantity, 0),
      aureusTotalValue: parseFloat((aureusShares.reduce((s, x) => s + x.quantity, 0) * aureusValuePerShare).toFixed(2)),
      dailyDividendPerShare: parseFloat(dailyDividendPerShare.toFixed(4)),
      myDailyDividend: parseFloat(myDailyDividend.toFixed(2)),
      totalSharesOutstanding,
    });
  } catch (error) {
    console.error("[shares] error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
