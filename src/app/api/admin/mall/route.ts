// Author: Klaasvaakie ( |╲ )
import { NextRequest, NextResponse } from "next/server";
import { EncoreRequestError, encoreRequest, encoreSessionToken } from "@/lib/encore-client";

type MallTransaction = { storeName: string; amount: number; costOfSale: number; vat: number; sharePool: number; kasiPool: number } & Record<string, unknown>;

export async function GET(req: NextRequest) {
  const token = await encoreSessionToken();
  if (!token) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get("limit") ?? 100), 1), 500);
  try {
    const data = await encoreRequest<{ transactions: MallTransaction[]; silos: unknown[]; memberCount: number }>(`/admin/mall?limit=${limit}`, {}, token);
    const storeMap = new Map<string, { revenue: number; count: number }>();
    for (const transaction of data.transactions) {
      const store = storeMap.get(transaction.storeName) ?? { revenue: 0, count: 0 };
      store.revenue += transaction.amount;
      store.count++;
      storeMap.set(transaction.storeName, store);
    }
    const totals = data.transactions.reduce((result, transaction) => ({
      amount: result.amount + transaction.amount,
      costOfSale: result.costOfSale + transaction.costOfSale,
      vat: result.vat + transaction.vat,
      sharePool: result.sharePool + transaction.sharePool,
      kasiPool: result.kasiPool + transaction.kasiPool,
    }), { amount: 0, costOfSale: 0, vat: 0, sharePool: 0, kasiPool: 0 });
    return NextResponse.json({
      ...data,
      totals,
      storePerformance: Array.from(storeMap, ([store, stats]) => ({ store, ...stats })).sort((left, right) => right.revenue - left.revenue),
      mallThreshold: 5000,
      mallProgress: Number(((data.memberCount / 5000) * 100).toFixed(1)),
    });
  } catch (error) {
    const status = error instanceof EncoreRequestError ? error.status : 500;
    return NextResponse.json({ error: "Unable to load Encore mall administration" }, { status });
  }
}
