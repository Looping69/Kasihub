import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/dashboard?memberId=xxx - aggregated dashboard stats for a member
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const memberId = searchParams.get("memberId");

    if (!memberId) {
      return NextResponse.json({ error: "memberId is required" }, { status: 400 });
    }

    const member = await db.member.findUnique({ where: { id: memberId } });
    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // Transactions
    const transactions = await db.transaction.findMany({
      where: { memberId },
      orderBy: { createdAt: "desc" },
      take: 30,
    });

    // Pool distributions (last 30 days)
    const poolDistributions = await db.kasiPoolDistribution.findMany({
      where: { memberId },
      orderBy: { payoutDate: "desc" },
      take: 30,
    });

    // Shares owned by this member
    const shares = await db.share.findMany({
      where: { memberId, status: "ACTIVE" },
    });
    const shareCount = shares.reduce((s, x) => s + x.quantity, 0);
    const shareValue = shares.reduce((s, x) => s + x.totalAmount, 0);

    // Matrix downline count (members whose upline chain includes this member)
    const myNode = await db.matrixNode.findUnique({
      where: { memberId },
    });

    let matrixDownline = 0;
    let matrixLevels = 0;
    if (myNode) {
      // Count all nodes whose parent chain leads to this node.
      // For SQLite simplicity, fetch all nodes and walk parent chain.
      const allNodes = await db.matrixNode.findMany({
        include: { member: true },
      });
      const childMap = new Map<string, string[]>();
      for (const n of allNodes) {
        if (n.parentId) {
          const arr = childMap.get(n.parentId) || [];
          arr.push(n.id);
          childMap.set(n.parentId, arr);
        }
      }
      // BFS from myNode
      const visited = new Set<string>();
      const queue = [myNode.id];
      let maxLevel = 0;
      while (queue.length) {
        const cur = queue.shift()!;
        const children = childMap.get(cur) || [];
        for (const c of children) {
          if (!visited.has(c)) {
            visited.add(c);
            matrixDownline++;
            const cNode = allNodes.find((n) => n.id === c);
            if (cNode) {
              const relLevel = cNode.level - myNode.level;
              if (relLevel > maxLevel) maxLevel = relLevel;
            }
            queue.push(c);
          }
        }
      }
      matrixLevels = maxLevel;
    }

    // Roots Bank pioneer eligibility
    const rootsShare = await db.rootsBankShare.findFirst({
      where: { memberId, pioneerPool: true },
    });

    // Earnings trend (last 14 days from pool distributions)
    const trendMap = new Map<string, number>();
    const now = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      trendMap.set(key, 0);
    }
    for (const p of poolDistributions) {
      const key = new Date(p.payoutDate).toISOString().slice(0, 10);
      if (trendMap.has(key)) {
        trendMap.set(key, (trendMap.get(key) || 0) + p.amount);
      }
    }
    const earningsTrend = Array.from(trendMap.entries()).map(([date, amount]) => ({
      date,
      amount: parseFloat(amount.toFixed(2)),
    }));

    // Earnings breakdown by source
    const sourceMap = new Map<string, number>();
    for (const t of transactions) {
      if (t.amount > 0) {
        sourceMap.set(t.type, (sourceMap.get(t.type) || 0) + t.amount);
      }
    }
    const colorMap: Record<string, string> = {
      MATRIX_PAYOUT: "oklch(0.52 0.13 158)",
      POOL_PAYOUT: "oklch(0.75 0.15 80)",
      DAILY_SHARE: "oklch(0.65 0.18 145)",
      PIONEER: "oklch(0.55 0.08 50)",
      DIVIDEND: "oklch(0.7 0.12 95)",
    };
    const labelMap: Record<string, string> = {
      MATRIX_PAYOUT: "Matrix Commission",
      POOL_PAYOUT: "KasiPool",
      DAILY_SHARE: "Daily Share",
      PIONEER: "Pioneer Pool",
      DIVIDEND: "Dividends",
    };
    const earningsBreakdown = Array.from(sourceMap.entries()).map(([type, value]) => ({
      name: labelMap[type] || type,
      value: parseFloat(value.toFixed(2)),
      color: colorMap[type] || "oklch(0.5 0.1 150)",
    }));

    // Total earnings (all-time positive transactions)
    const allPositiveTx = await db.transaction.findMany({
      where: { memberId, amount: { gt: 0 } },
    });
    const totalEarnings = allPositiveTx.reduce((s, t) => s + t.amount, 0);

    // Monthly earnings (this member's stored monthlyEarnings)
    const monthlyEarnings = member.monthlyEarnings;

    // Pool share total (last 30 days)
    const poolShareTotal = poolDistributions.reduce((s, p) => s + p.amount, 0);

    // Daily dividend estimate (avg of last 7 daily share txns)
    const dailyShares = transactions.filter((t) => t.type === "DAILY_SHARE");
    const dailyDividend =
      dailyShares.length > 0
        ? dailyShares.reduce((s, t) => s + t.amount, 0) / Math.min(dailyShares.length, 7)
        : 0;

    return NextResponse.json({
      member,
      totalEarnings: parseFloat(totalEarnings.toFixed(2)),
      monthlyEarnings,
      poolShareTotal: parseFloat(poolShareTotal.toFixed(2)),
      shareCount,
      shareValue: parseFloat(shareValue.toFixed(2)),
      dailyDividend: parseFloat(dailyDividend.toFixed(2)),
      matrixDownline,
      matrixLevels,
      pioneerPoolEligible: !!rootsShare,
      transactions: transactions.map((t) => ({
        ...t,
        createdAt: t.createdAt.toISOString(),
      })),
      poolDistributions: poolDistributions.map((p) => ({
        ...p,
        payoutDate: p.payoutDate.toISOString(),
      })),
      earningsTrend,
      earningsBreakdown,
    });
  } catch (error) {
    console.error("[dashboard] error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
