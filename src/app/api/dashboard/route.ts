// Author: Klaasvaakie ( |╲ )
import { NextRequest, NextResponse } from "next/server";
import { EncoreRequestError, encoreRequest, encoreSessionToken } from "@/lib/encore-client";
import type { Member } from "@/lib/types";

type ProfileResponse = { member: Member };
type WalletResponse = { balance: string; currency: string; transactions: unknown[] };
type MatrixResponse = { nodes: { depth: number }[] };
type ShareResponse = { certificates: { totalShares: number; status: string }[] };
type PhaseResponse = { phases: { phaseNumber: number; pricePerShare: string; status: string }[] };

export async function GET(req: NextRequest) {
  const memberId = req.nextUrl.searchParams.get("memberId");
  const token = await encoreSessionToken();
  if (!memberId) return NextResponse.json({ error: "memberId is required" }, { status: 400 });
  if (!token) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  try {
    const { profile, wallet, matrix, shares, phases } = await encoreRequest<{
      profile: ProfileResponse;
      wallet: WalletResponse;
      matrix: MatrixResponse;
      shares: ShareResponse;
      phases: PhaseResponse;
    }>(`/dashboard/${encodeURIComponent(memberId)}`, {}, token);
    if (profile.member.id !== memberId) {
      return NextResponse.json({ error: "Member identity mismatch" }, { status: 403 });
    }
    const activeCertificates = shares.certificates.filter((certificate) => certificate.status !== "revoked");
    const shareCount = activeCertificates.reduce((sum, certificate) => sum + certificate.totalShares, 0);
    const activePhase = phases.phases.find((phase) => phase.status === "active") ?? phases.phases[0];
    const shareValue = Number(activePhase?.pricePerShare ?? 0);
    const totalEarnings = Number(wallet.balance || 0);
    const rootDepth = matrix.nodes[0]?.depth ?? 0;
    const downline = matrix.nodes.slice(1);
    const levels = downline.reduce((max, node) => Math.max(max, node.depth - rootDepth), 0);
    const totalEarningsTrend = Array.from({ length: 14 }, (_, index) => {
      const date = new Date();
      date.setUTCDate(date.getUTCDate() - (13 - index));
      return { date: date.toISOString().slice(0, 10), amount: 0 };
    });
    const emptyPool = { total: 0, today: 0, distributions: [] as unknown[] };
    return NextResponse.json({
      member: profile.member,
      totalEarnings,
      monthlyEarnings: profile.member.monthlyEarnings,
      earningsToday: 0,
      earningsThisWeek: 0,
      earningsThisMonth: profile.member.monthlyEarnings,
      ecosystemEarningsToday: 0,
      pools: {
        pioneer: { ...emptyPool, eligible: false },
        marketplace: emptyPool,
        shareholders: { ...emptyPool, eligible: shareCount > 0 },
      },
      kasiShares: { count: shareCount, valuePerShare: shareValue, totalValue: shareCount * shareValue },
      aureusShares: { count: 0, valuePerShare: 0, totalValue: 0 },
      rootsBankShares: { count: 0, totalValue: 0 },
      ecosystemDownline: downline.length,
      ecosystemLevels: levels,
      pioneerPoolEligible: false,
      auditorNotified: profile.member.taxThreshold,
      transactions: wallet.transactions,
      poolDistributions: [],
      totalEarningsTrend,
      earningsBreakdown: totalEarnings > 0
        ? [{ name: "Encore wallet", value: totalEarnings, color: "oklch(0.52 0.13 158)" }]
        : [],
    });
  } catch (error) {
    const status = error instanceof EncoreRequestError ? error.status : 500;
    return NextResponse.json({ error: "Unable to load dashboard from Encore" }, { status });
  }
}
