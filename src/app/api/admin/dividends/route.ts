import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST /api/admin/dividends - declare a new dividend and distribute to shareholders
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { amount } = body;

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "A positive amount is required" }, { status: 400 });
    }

    // Get all active shares grouped by member
    const shares = await db.share.findMany({
      where: { status: "ACTIVE" },
      include: { member: { select: { id: true, subscriptionStatus: true } } },
    });

    // Only members with ACTIVE subscription are eligible
    const eligibleShares = shares.filter((s) => s.member.subscriptionStatus === "ACTIVE");
    const totalShares = eligibleShares.reduce((s, x) => s + x.quantity, 0);

    if (totalShares === 0) {
      return NextResponse.json({ error: "No eligible shares to distribute to" }, { status: 400 });
    }

    const perShareAmount = parseFloat((amount / totalShares).toFixed(4));

    // Create the declaration
    const declaration = await db.dividendDeclaration.create({
      data: {
        amount: parseFloat(amount.toFixed(2)),
        totalShares,
        perShareAmount,
        status: "PAID",
        paidAt: new Date(),
      },
    });

    // Distribute to each eligible member (group shares by member)
    const memberShareMap = new Map<string, number>();
    for (const s of eligibleShares) {
      memberShareMap.set(s.member.id, (memberShareMap.get(s.member.id) || 0) + s.quantity);
    }

    for (const [memberId, qty] of memberShareMap) {
      const payout = parseFloat((qty * perShareAmount).toFixed(2));
      await db.transaction.create({
        data: {
          memberId,
          type: "DIVIDEND",
          amount: payout,
          description: `Dividend declaration — ${qty} shares × $${perShareAmount.toFixed(4)}`,
          status: "COMPLETED",
        },
      });
    }

    return NextResponse.json({
      declaration: {
        ...declaration,
        declaredAt: declaration.declaredAt.toISOString(),
        paidAt: declaration.paidAt?.toISOString() || null,
      },
      distributedTo: memberShareMap.size,
      totalShares,
      perShareAmount,
    });
  } catch (error) {
    console.error("[admin/dividends] error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
