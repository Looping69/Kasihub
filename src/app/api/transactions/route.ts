import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/transactions?memberId=xxx - full transaction history
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const memberId = searchParams.get("memberId");
    if (!memberId) {
      return NextResponse.json({ error: "memberId is required" }, { status: 400 });
    }

    const transactions = await db.transaction.findMany({
      where: { memberId },
      orderBy: { createdAt: "desc" },
    });

    const subscriptions = await db.subscription.findMany({
      where: { memberId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      transactions: transactions.map((t) => ({ ...t, createdAt: t.createdAt.toISOString() })),
      subscriptions: subscriptions.map((s) => ({ ...s, createdAt: s.createdAt.toISOString() })),
    });
  } catch (error) {
    console.error("[transactions] error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
