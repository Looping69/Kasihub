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
    // Value reflects the phase the shares were purchased in
    // Each share's value = the pricePerShare of its phase (from the phases table)
    // For legacy/Phase 1 BOGO shares, the value is the current share value setting
    const phaseValueMap = new Map<number, number>();
    for (const p of phases) {
      phaseValueMap.set(p.phase, p.pricePerShare);
    }
    // Calculate total value = sum of (each share's quantity × its phase price)
    const totalValue = activeShares.reduce((s, x) => {
      const phasePrice = phaseValueMap.get(x.phase) || shareValuePerShare;
      return s + (x.quantity * phasePrice);
    }, 0);

    // Add "legacy" flag: shares purchased in Phase 1 with BOGO are "legacy shares FREE"
    const activeSharesWithMeta = activeShares.map((s) => {
      const phase = phases.find((p) => p.phase === s.phase);
      const isLegacy = s.phase === 1 && phase?.bonusBuyOneGet;
      const phasePrice = phaseValueMap.get(s.phase) || shareValuePerShare;
      return {
        ...s,
        isLegacy: !!isLegacy,
        currentValuePerShare: phasePrice,
        currentTotalValue: s.quantity * phasePrice,
        createdAt: s.createdAt.toISOString(),
      };
    });

    // Calculate dividends (simulated): daily share of KasiMall profits
    const allSharesCount = await db.share.aggregate({
      where: { status: "ACTIVE" },
      _sum: { quantity: true },
    });
    const totalSharesOutstanding = allSharesCount._sum.quantity || 1;
    const dailyProfitPoolZAR = 37000; // ZAR simulated daily profit pool (~$2000 × 18.5)
    const dailyProfitSharePerShare = dailyProfitPoolZAR / totalSharesOutstanding;
    const myDailyProfitShare = totalShares * dailyProfitSharePerShare;

    return NextResponse.json({
      phases,
      activeShares: activeSharesWithMeta,
      retractedShares: retractedShares.map((s) => ({ ...s, createdAt: s.createdAt.toISOString() })),
      aureusShares: aureusShares.map((s) => ({ ...s, createdAt: s.createdAt.toISOString() })),
      retractedAureusShares: retractedAureusShares.map((s) => ({ ...s, createdAt: s.createdAt.toISOString() })),
      totalShares,
      totalValue: parseFloat(totalValue.toFixed(2)),
      shareValuePerShare,
      // Legacy shares (Phase 1 BOGO) count
      legacyShares: activeShares.filter((s) => s.phase === 1 && phases.find((p) => p.phase === 1)?.bonusBuyOneGet).reduce((sum, s) => sum + s.quantity, 0),
      aureusValuePerShare,
      aureusTotalShares: aureusShares.reduce((s, x) => s + x.quantity, 0),
      aureusTotalValue: parseFloat((aureusShares.reduce((s, x) => s + x.quantity, 0) * aureusValuePerShare).toFixed(2)),
      // Daily profit share (in ZAR, not USD)
      dailyProfitSharePerShare: parseFloat(dailyProfitSharePerShare.toFixed(2)),
      myDailyProfitShare: parseFloat(myDailyProfitShare.toFixed(2)),
      totalSharesOutstanding,
    });
  } catch (error) {
    console.error("[shares] error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
