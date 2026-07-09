import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/mall?memberId=xxx - get mall transactions + silo config + member NFC tag
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const memberId = searchParams.get("memberId");

    let nfcTagId: string | null = null;
    if (memberId) {
      const member = await db.member.findUnique({ where: { id: memberId } });
      nfcTagId = member?.nfcTagId ?? null;
    }

    const where = nfcTagId ? { nfcTagId } : {};
    const transactions = await db.mallTransaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    // Aggregate totals
    const allTx = await db.mallTransaction.findMany({ where });
    const totals = allTx.reduce(
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

    // Silo split percentages (editable by Exco in production)
    const silos = [
      { name: "Cost of Sale (Suppliers)", pct: 65, color: "oklch(0.55 0.08 50)", description: "Paid to suppliers for goods sold at KasiMall stores" },
      { name: "VAT", pct: 15, color: "oklch(0.65 0.18 145)", description: "Value Added Tax remitted to SARS" },
      { name: "KasiShare Pool", pct: 10, color: "oklch(0.75 0.15 80)", description: "Distributed daily to KasiShare holders" },
      { name: "KasiPool", pct: 10, color: "oklch(0.52 0.13 158)", description: "Shared equally among eligible Hub members, paid nightly" },
    ];

    // Mall progress: 5000 members needed per area to build a mall
    const memberCount = await db.member.count();
    const mallProgress = Math.min((memberCount / 5000) * 100, 100);

    return NextResponse.json({
      nfcTagId,
      transactions: transactions.map((t) => ({ ...t, createdAt: t.createdAt.toISOString() })),
      totals: {
        amount: parseFloat(totals.amount.toFixed(2)),
        costOfSale: parseFloat(totals.costOfSale.toFixed(2)),
        vat: parseFloat(totals.vat.toFixed(2)),
        sharePool: parseFloat(totals.sharePool.toFixed(2)),
        kasiPool: parseFloat(totals.kasiPool.toFixed(2)),
      },
      silos,
      mallProgress: parseFloat(mallProgress.toFixed(1)),
      memberCount,
      mallThreshold: 5000,
    });
  } catch (error) {
    console.error("[mall] error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
