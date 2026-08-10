// Author: Klaasvaakie ( |╲ )
import { NextRequest, NextResponse } from "next/server";
import { EncoreRequestError, encoreRequest, encoreSessionToken } from "@/lib/encore-client";
import type { Member } from "@/lib/types";

type ProfileResponse = { member: Member };
type WalletTransaction = { id: string; type: string; amount: number; description: string; status: string; createdAt: string };
type WalletResponse = { balance: string; currency: string; transactions: WalletTransaction[] };
type MatrixResponse = { nodes: { depth: number }[] };
type ShareResponse = { certificates: { totalShares: number; status: string }[] };
type PhaseResponse = { phases: { phaseNumber: number; pricePerShare: string; status: string }[] };
type Distribution = { id: string; amount: number; source: string; poolType: string; status: string; payoutDate: string };
type PoolSummary = { total: number; today: number; distributions: Distribution[] };
type FinanceSummaryResponse = { distributions: Distribution[]; pools: Record<string, PoolSummary> };
type RootsBankResponse = {
  pioneerCount: number;
  myShare: null | {
    sharePrice: number;
    totalAmount: number;
    pioneerPool: boolean;
    status: string;
  };
};

const BREAKDOWN_COLORS = [
  "oklch(0.52 0.13 158)",
  "oklch(0.65 0.18 145)",
  "oklch(0.75 0.15 80)",
  "oklch(0.65 0.2 55)",
  "oklch(0.6 0.2 15)",
  "oklch(0.5 0.2 300)",
];

export async function GET(req: NextRequest) {
  const memberId = req.nextUrl.searchParams.get("memberId");
  const token = await encoreSessionToken();
  if (!memberId) return NextResponse.json({ error: "memberId is required" }, { status: 400 });
  if (!token) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  try {
    const [dashboard, finance, rootsBank] = await Promise.all([
      encoreRequest<{
        profile: ProfileResponse;
        wallet: WalletResponse;
        matrix: MatrixResponse;
        shares: ShareResponse;
        phases: PhaseResponse;
      }>(`/dashboard/${encodeURIComponent(memberId)}`, {}, token),
      encoreRequest<FinanceSummaryResponse>(`/finance/me/${encodeURIComponent(memberId)}/summary`, {}, token),
      encoreRequest<RootsBankResponse>(`/rootsbank/${encodeURIComponent(memberId)}`, {}, token),
    ]);

    const { profile, wallet, matrix, shares, phases } = dashboard;
    if (profile.member.id !== memberId) {
      return NextResponse.json({ error: "Member identity mismatch" }, { status: 403 });
    }

    const activeCertificates = shares.certificates.filter((certificate) => certificate.status !== "revoked");
    const shareCount = activeCertificates.reduce((sum, certificate) => sum + certificate.totalShares, 0);
    const activePhase = phases.phases.find((phase) => phase.status === "active") ?? phases.phases[0];
    const shareValue = Number(activePhase?.pricePerShare ?? 0);
    const walletBalance = Number(wallet.balance || 0);

    const rootDepth = matrix.nodes[0]?.depth ?? 0;
    const downline = matrix.nodes.slice(1);
    const levels = downline.reduce((max, node) => Math.max(max, node.depth - rootDepth), 0);

    const earningTransactions = wallet.transactions.filter(isEarningTransaction);
    const metrics = deriveEarningMetrics(earningTransactions);
    const pioneer = pool(finance.pools, "PIONEER");
    const marketplace = pool(finance.pools, "MARKETPLACE");
    const shareholders = pool(finance.pools, "SHAREHOLDERS");
    const rootsShareActive = Boolean(rootsBank.myShare && !["REVOKED", "CANCELLED"].includes(rootsBank.myShare.status.toUpperCase()));
    const pioneerEligible = Boolean(rootsShareActive && rootsBank.myShare?.pioneerPool);

    return NextResponse.json({
      member: profile.member,
      walletBalance,
      walletCurrency: wallet.currency,
      totalEarnings: metrics.total,
      monthlyEarnings: metrics.month,
      earningsToday: metrics.today,
      earningsThisWeek: metrics.week,
      earningsThisMonth: metrics.month,
      ecosystemEarningsToday: metrics.ecosystemToday,
      pools: {
        pioneer: { ...pioneer, eligible: pioneerEligible },
        marketplace,
        shareholders: { ...shareholders, eligible: shareCount > 0 },
      },
      kasiShares: { count: shareCount, valuePerShare: shareValue, totalValue: shareCount * shareValue },
      aureusShares: { count: 0, valuePerShare: 0, totalValue: 0 },
      rootsBankShares: {
        count: rootsShareActive ? 1 : 0,
        totalValue: rootsShareActive ? Number(rootsBank.myShare?.sharePrice ?? 0) : 0,
      },
      ecosystemDownline: downline.length,
      ecosystemLevels: levels,
      pioneerPoolEligible: pioneerEligible,
      auditorNotified: profile.member.taxThreshold || metrics.month >= 7_500,
      transactions: wallet.transactions,
      poolDistributions: finance.distributions,
      totalEarningsTrend: metrics.trend,
      earningsBreakdown: metrics.breakdown,
    });
  } catch (error) {
    const status = error instanceof EncoreRequestError ? error.status : 500;
    return NextResponse.json({ error: "Unable to load dashboard from Encore" }, { status });
  }
}

function pool(pools: Record<string, PoolSummary>, key: string): PoolSummary {
  return pools[key] ?? { total: 0, today: 0, distributions: [] };
}

function isEarningTransaction(transaction: WalletTransaction): boolean {
  if (!(transaction.amount > 0)) return false;
  const type = transaction.type.toUpperCase();
  return type !== "OPENING_BALANCE" && type !== "OPENING_DEFICIT";
}

function deriveEarningMetrics(transactions: WalletTransaction[]) {
  const now = new Date();
  const todayKey = johannesburgDateKey(now);
  const monthKey = todayKey.slice(0, 7);
  const weekStartKey = johannesburgWeekStartKey(now);
  const trendDates = lastJohannesburgDateKeys(now, 14);
  const trendByDate = new Map(trendDates.map((date) => [date, 0]));
  const breakdownByType = new Map<string, number>();

  let total = 0;
  let today = 0;
  let week = 0;
  let month = 0;
  let ecosystemToday = 0;

  for (const transaction of transactions) {
    const amount = Number(transaction.amount);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    const dateKey = johannesburgDateKey(new Date(transaction.createdAt));
    const type = transaction.type.toUpperCase();
    total += amount;
    if (dateKey === todayKey) {
      today += amount;
      if (type.includes("MATRIX") || type.includes("UPLINE") || type.includes("ECOSYSTEM")) ecosystemToday += amount;
    }
    if (dateKey >= weekStartKey && dateKey <= todayKey) week += amount;
    if (dateKey.startsWith(monthKey)) month += amount;
    if (trendByDate.has(dateKey)) trendByDate.set(dateKey, (trendByDate.get(dateKey) ?? 0) + amount);
    breakdownByType.set(type, (breakdownByType.get(type) ?? 0) + amount);
  }

  const breakdown = Array.from(breakdownByType.entries())
    .sort((left, right) => right[1] - left[1])
    .map(([type, value], index) => ({
      name: humanizeTransactionType(type),
      value: roundMoney(value),
      color: BREAKDOWN_COLORS[index % BREAKDOWN_COLORS.length],
    }));

  return {
    total: roundMoney(total),
    today: roundMoney(today),
    week: roundMoney(week),
    month: roundMoney(month),
    ecosystemToday: roundMoney(ecosystemToday),
    trend: trendDates.map((date) => ({ date, amount: roundMoney(trendByDate.get(date) ?? 0) })),
    breakdown,
  };
}

function humanizeTransactionType(type: string): string {
  return type
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function johannesburgDateKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Johannesburg",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function johannesburgWeekStartKey(date: Date): string {
  const localKey = johannesburgDateKey(date);
  const localDate = new Date(`${localKey}T00:00:00Z`);
  const day = localDate.getUTCDay();
  const daysSinceMonday = day === 0 ? 6 : day - 1;
  localDate.setUTCDate(localDate.getUTCDate() - daysSinceMonday);
  return localDate.toISOString().slice(0, 10);
}

function lastJohannesburgDateKeys(date: Date, count: number): string[] {
  const currentKey = johannesburgDateKey(date);
  const cursor = new Date(`${currentKey}T00:00:00Z`);
  const dates: string[] = [];
  for (let index = count - 1; index >= 0; index -= 1) {
    const item = new Date(cursor);
    item.setUTCDate(cursor.getUTCDate() - index);
    dates.push(item.toISOString().slice(0, 10));
  }
  return dates;
}
