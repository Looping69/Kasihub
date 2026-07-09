import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST /api/rootsbank/purchase - register for Roots Bank pioneer shares
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { memberId, category, paymentRef } = body;

    if (!memberId || !category) {
      return NextResponse.json({ error: "memberId and category are required" }, { status: 400 });
    }

    const validCategories = ["KIDS_STUDENT", "ADULT", "PENSIONER"];
    if (!validCategories.includes(category)) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }

    const member = await db.member.findUnique({ where: { id: memberId } });
    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // Check pioneer cap of 200
    const pioneerCount = await db.rootsBankShare.count();
    if (pioneerCount >= 200) {
      return NextResponse.json(
        { error: "All 200 Pioneer Pool spots have been filled." },
        { status: 400 }
      );
    }

    // Check if already registered
    const existing = await db.rootsBankShare.findFirst({ where: { memberId } });
    if (existing) {
      return NextResponse.json(
        { error: "You have already purchased a Roots Bank pioneer share." },
        { status: 400 }
      );
    }

    const fees = {
      KIDS_STUDENT: { sharePrice: 500, membershipFee: 50 },
      ADULT: { sharePrice: 500, membershipFee: 200 },
      PENSIONER: { sharePrice: 500, membershipFee: 50 },
    };
    const f = fees[category as keyof typeof fees];
    const totalAmount = f.sharePrice + f.membershipFee;

    const rbs = await db.rootsBankShare.create({
      data: {
        memberId,
        category,
        sharePrice: f.sharePrice,
        membershipFee: f.membershipFee,
        totalAmount,
        paymentRef: paymentRef || `RBS-2025-${String(pioneerCount + 1).padStart(4, "0")}`,
        pioneerPool: true,
        status: "REGISTERED",
      },
    });

    // Record transaction
    await db.transaction.create({
      data: {
        memberId,
        type: "PIONEER",
        amount: -totalAmount,
        description: `Roots Bank Pioneer Share — ${category} (R${f.sharePrice} share + R${f.membershipFee} membership)`,
        status: "COMPLETED",
      },
    });

    return NextResponse.json({
      rootsBankShare: { ...rbs, createdAt: rbs.createdAt.toISOString() },
      pioneerCount: pioneerCount + 1,
      pioneerRemaining: 200 - (pioneerCount + 1),
    });
  } catch (error) {
    console.error("[rootsbank/purchase] error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
