// Author: Klaasvaakie ( |╲ )
import { NextRequest, NextResponse } from "next/server";
import { EncoreRequestError, encoreRequest, encoreSessionToken } from "@/lib/encore-client";

type MallTransaction = { amount: number; costOfSale: number; vat: number; sharePool: number; kasiPool: number } & Record<string, unknown>;
type Silo = { name: string; percentage: number; color: string; description: string | null };

export async function GET(req: NextRequest) {
  const memberId = req.nextUrl.searchParams.get("memberId");
  const token = await encoreSessionToken();
  if (!memberId) return NextResponse.json({ error: "memberId is required" }, { status: 400 });
  if (!token) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  try {
    const data = await encoreRequest<{ transactions: MallTransaction[]; silos: Silo[]; memberCount: number }>(`/mall/${encodeURIComponent(memberId)}`, {}, token);
    return NextResponse.json({
      nfcTagId: `NFC-${memberId.slice(0, 12).toUpperCase()}`,
      transactions: data.transactions,
      totals: totals(data.transactions),
      silos: data.silos.map((silo) => ({ name: silo.name, pct: silo.percentage, color: silo.color, description: silo.description })),
      mallProgress: Number((Math.min(data.memberCount / 5000, 1) * 100).toFixed(1)),
      memberCount: data.memberCount,
      mallThreshold: 5000,
    });
  } catch (error) {
    const status = error instanceof EncoreRequestError ? error.status : 500;
    return NextResponse.json({ error: "Unable to load mall from Encore" }, { status });
  }
}

function totals(transactions: MallTransaction[]) {
  return transactions.reduce((result, transaction) => ({
    amount: result.amount + transaction.amount,
    costOfSale: result.costOfSale + transaction.costOfSale,
    vat: result.vat + transaction.vat,
    sharePool: result.sharePool + transaction.sharePool,
    kasiPool: result.kasiPool + transaction.kasiPool,
  }), { amount: 0, costOfSale: 0, vat: 0, sharePool: 0, kasiPool: 0 });
}
