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

    // Fetch settings for share values
    const kasiShareValueSetting = await db.setting.findUnique({ where: { key: "kasi_share_current_value_usd" } });
    const aureusShareValueSetting = await db.setting.findUnique({ where: { key: "aureus_share_current_value_usd" } });
    const kasiShareValue = kasiShareValueSetting ? parseFloat(kasiShareValueSetting.value) : 39.95;
    const aureusShareValue = aureusShareValueSetting ? parseFloat(aureusShareValueSetting.value) : 15.00;

    // Transactions (last 60 for trend)
    const transactions = await db.transaction.findMany({
      where: { memberId },
      orderBy: { createdAt: "desc" },
      take: 60,
    });

    // Pool distributions (last 30 days) — grouped by poolType
    const poolDistributions = await db.kasiPoolDistribution.findMany({
      where: { memberId },
      orderBy: { payoutDate: "desc" },
      take: 90,
    });

    // ============ 3 POOLS ============
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const pioneerDistributions = poolDistributions.filter((p) => p.poolType === "PIONEER");
    const marketplaceDistributions = poolDistributions.filter((p) => p.poolType === "MARKETPLACE");
    const shareholdersDistributions = poolDistributions.filter((p) => p.poolType === "SHAREHOLDERS");

    const pioneerPoolTotal = pioneerDistributions.reduce((s, p) => s + p.amount, 0);
    const marketplacePoolTotal = marketplaceDistributions.reduce((s, p) => s + p.amount, 0);
    const shareholdersPoolTotal = shareholdersDistributions.reduce((s, p) => s + p.amount, 0);

    // Today's pool amounts
    const pioneerPoolToday = pioneerDistributions
      .filter((p) => new Date(p.payoutDate) >= todayStart)
      .reduce((s, p) => s + p.amount, 0);
    const marketplacePoolToday = marketplaceDistributions
      .filter((p) => new Date(p.payoutDate) >= todayStart)
      .reduce((s, p) => s + p.amount, 0);
    const shareholdersPoolToday = shareholdersDistributions
      .filter((p) => new Date(p.payoutDate) >= todayStart)
      .reduce((s, p) => s + p.amount, 0);

    // ============ SHARES ============
    const kasiShares = await db.share.findMany({
      where: { memberId, status: "ACTIVE" },
    });
    const kasiShareCount = kasiShares.reduce((s, x) => s + x.quantity, 0);
    const kasiShareTotalValue = kasiShareCount * kasiShareValue;

    const aureusShares = await db.aureusShare.findMany({
      where: { memberId, status: "ACTIVE" },
    });
    const aureusShareCount = aureusShares.reduce((s, x) => s + x.quantity, 0);
    const aureusShareTotalValue = aureusShareCount * aureusShareValue;

    // Roots Bank pioneer shares
    const rootsBankShares = await db.rootsBankShare.findMany({
      where: { memberId, pioneerPool: true },
    });
    const rootsBankShareCount = rootsBankShares.length;
    const rootsBankShareValue = rootsBankShares.reduce((s, x) => s + x.totalAmount, 0);

    // ============ ECOSYSTEM ============
    const myNode = await db.matrixNode.findUnique({ where: { memberId } });
    let ecosystemDownline = 0;
    let ecosystemLevels = 0;
    if (myNode) {
      const allNodes = await db.matrixNode.findMany({ include: { member: true } });
      const childMap = new Map<string, string[]>();
      for (const n of allNodes) {
        if (n.parentId) {
          const arr = childMap.get(n.parentId) || [];
          arr.push(n.id);
          childMap.set(n.parentId, arr);
        }
      }
      const visited = new Set<string>();
      const queue = [myNode.id];
      let maxLevel = 0;
      while (queue.length) {
        const cur = queue.shift()!;
        const children = childMap.get(cur) || [];
        for (const c of children) {
          if (!visited.has(c)) {
            visited.add(c);
            ecosystemDownline++;
            const cNode = allNodes.find((n) => n.id === c);
            if (cNode) {
              const relLevel = cNode.level - myNode.level;
              if (relLevel > maxLevel) maxLevel = relLevel;
            }
            queue.push(c);
          }
        }
      }
      ecosystemLevels = maxLevel;
    }

    // ============ DAILY / WEEKLY / MONTHLY ECOSYSTEM EARNINGS ============
    const allPositiveTx = await db.transaction.findMany({
      where: { memberId, amount: { gt: 0 } },
      orderBy: { createdAt: "asc" },
    });

    // Today's earnings (all positive transactions today)
    const earningsToday = allPositiveTx
      .filter((t) => new Date(t.createdAt) >= todayStart)
      .reduce((s, t) => s + t.amount, 0);

    // This week (Monday to Sunday)
    const weekStart = new Date(now);
    const dayOfWeek = weekStart.getDay(); // 0 = Sunday
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    weekStart.setDate(weekStart.getDate() + mondayOffset);
    weekStart.setHours(0, 0, 0, 0);
    const earningsThisWeek = allPositiveTx
      .filter((t) => new Date(t.createdAt) >= weekStart)
      .reduce((s, t) => s + t.amount, 0);

    // This month (1st to last day)
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const earningsThisMonth = allPositiveTx
      .filter((t) => new Date(t.createdAt) >= monthStart)
      .reduce((s, t) => s + t.amount, 0);

    // Total earnings (all-time)
    const totalEarnings = allPositiveTx.reduce((s, t) => s + t.amount, 0);

    // Ecosystem earnings today (matrix + pools today)
    const ecosystemEarningsToday = earningsToday;

    // ============ TOTAL EARNINGS TREND (14 days, replaces KasiPool earnings) ============
    const earningsTrendMap = new Map<string, number>();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      earningsTrendMap.set(d.toISOString().slice(0, 10), 0);
    }
    for (const t of allPositiveTx) {
      const key = new Date(t.createdAt).toISOString().slice(0, 10);
      if (earningsTrendMap.has(key)) {
        earningsTrendMap.set(key, (earningsTrendMap.get(key) || 0) + t.amount);
      }
    }
    const totalEarningsTrend = Array.from(earningsTrendMap.entries()).map(([date, amount]) => ({
      date,
      amount: parseFloat(amount.toFixed(2)),
    }));

    // Earnings breakdown by source
    const sourceMap = new Map<string, number>();
    for (const t of allPositiveTx) {
      sourceMap.set(t.type, (sourceMap.get(t.type) || 0) + t.amount);
    }
    const colorMap: Record<string, string> = {
      MATRIX_PAYOUT: "oklch(0.52 0.13 158)",
      POOL_PAYOUT: "oklch(0.75 0.15 80)",
      DAILY_SHARE: "oklch(0.65 0.18 145)",
      PIONEER: "oklch(0.55 0.08 50)",
      DIVIDEND: "oklch(0.7 0.12 95)",
    };
    const labelMap: Record<string, string> = {
      MATRIX_PAYOUT: "Eco-System Commission",
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

    // ============ AUDITOR NOTIFICATION CHECK ============
    // If member's monthly earnings exceed R7000 and no notification sent this month,
    // create one automatically
    const currentMonth = now.toISOString().slice(0, 7);
    const existingNotif = await db.auditorNotification.findFirst({
      where: { memberId, month: currentMonth },
    });
    let auditorNotified = !!existingNotif;
    if (!existingNotif && earningsThisMonth > 7000) {
      await db.auditorNotification.create({
        data: {
          memberId,
          monthEarnings: parseFloat(earningsThisMonth.toFixed(2)),
          month: currentMonth,
          status: "SENT",
        },
      });
      // Mark member as tax threshold eligible
      await db.member.update({
        where: { id: memberId },
        data: { taxThreshold: true },
      });
      auditorNotified = true;
    }

    return NextResponse.json({
      member: {
        ...member,
        createdAt: member.createdAt.toISOString(),
        updatedAt: member.updatedAt.toISOString(),
        kycVerifiedAt: member.kycVerifiedAt?.toISOString() || null,
        instapayVerifiedAt: member.instapayVerifiedAt?.toISOString() || null,
      },
      // Total earnings
      totalEarnings: parseFloat(totalEarnings.toFixed(2)),
      monthlyEarnings: member.monthlyEarnings,
      // Ecosystem earnings periods
      earningsToday: parseFloat(earningsToday.toFixed(2)),
      earningsThisWeek: parseFloat(earningsThisWeek.toFixed(2)),
      earningsThisMonth: parseFloat(earningsThisMonth.toFixed(2)),
      ecosystemEarningsToday: parseFloat(ecosystemEarningsToday.toFixed(2)),
      // 3 Pools
      pools: {
        pioneer: {
          total: parseFloat(pioneerPoolTotal.toFixed(2)),
          today: parseFloat(pioneerPoolToday.toFixed(2)),
          eligible: rootsBankShareCount > 0,
          distributions: pioneerDistributions.slice(0, 10).map((p) => ({
            ...p,
            payoutDate: p.payoutDate.toISOString(),
          })),
        },
        marketplace: {
          total: parseFloat(marketplacePoolTotal.toFixed(2)),
          today: parseFloat(marketplacePoolToday.toFixed(2)),
          distributions: marketplaceDistributions.slice(0, 10).map((p) => ({
            ...p,
            payoutDate: p.payoutDate.toISOString(),
          })),
        },
        shareholders: {
          total: parseFloat(shareholdersPoolTotal.toFixed(2)),
          today: parseFloat(shareholdersPoolToday.toFixed(2)),
          eligible: kasiShareCount > 0,
          distributions: shareholdersDistributions.slice(0, 10).map((p) => ({
            ...p,
            payoutDate: p.payoutDate.toISOString(),
          })),
        },
      },
      // Shares
      kasiShares: {
        count: kasiShareCount,
        valuePerShare: kasiShareValue,
        totalValue: parseFloat(kasiShareTotalValue.toFixed(2)),
      },
      aureusShares: {
        count: aureusShareCount,
        valuePerShare: aureusShareValue,
        totalValue: parseFloat(aureusShareTotalValue.toFixed(2)),
      },
      rootsBankShares: {
        count: rootsBankShareCount,
        totalValue: parseFloat(rootsBankShareValue.toFixed(2)),
      },
      // Eco-System
      ecosystemDownline,
      ecosystemLevels,
      pioneerPoolEligible: rootsBankShareCount > 0,
      auditorNotified,
      // Transactions
      transactions: transactions.map((t) => ({
        ...t,
        createdAt: t.createdAt.toISOString(),
      })),
      poolDistributions: poolDistributions.map((p) => ({
        ...p,
        payoutDate: p.payoutDate.toISOString(),
      })),
      // Charts
      totalEarningsTrend,
      earningsBreakdown,
    });
  } catch (error) {
    console.error("[dashboard] error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
