import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/referrals?memberId=xxx - get member's referrals
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const memberId = searchParams.get("memberId");
    if (!memberId) {
      return NextResponse.json({ error: "memberId is required" }, { status: 400 });
    }

    const referrals = await db.referral.findMany({
      where: { referrerId: memberId },
      orderBy: { createdAt: "desc" },
    });

    const totalRewards = referrals
      .filter((r) => r.status === "REGISTERED")
      .reduce((s, r) => s + r.rewardAmount, 0);

    return NextResponse.json({
      referrals: referrals.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
        convertedAt: r.convertedAt?.toISOString() || null,
      })),
      stats: {
        total: referrals.length,
        registered: referrals.filter((r) => r.status === "REGISTERED").length,
        pending: referrals.filter((r) => r.status === "PENDING").length,
        totalRewards: parseFloat(totalRewards.toFixed(2)),
      },
    });
  } catch (error) {
    console.error("[referrals] error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/referrals - create a new referral (refer an enabler)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { referrerId, referredName, referredEmail, referredMobile } = body;

    if (!referrerId || !referredName || !referredEmail || !referredMobile) {
      return NextResponse.json(
        { error: "referrerId, referredName, referredEmail, and referredMobile are required" },
        { status: 400 }
      );
    }

    const referrer = await db.member.findUnique({ where: { id: referrerId } });
    if (!referrer) {
      return NextResponse.json({ error: "Referrer not found" }, { status: 404 });
    }

    const referralCode = `REF-${referrer.profileNumber}-${Date.now().toString(36).toUpperCase().slice(-4)}`;

    const referral = await db.referral.create({
      data: {
        referrerId,
        referralCode,
        referredName,
        referredEmail,
        referredMobile,
        status: "PENDING",
      },
    });

    return NextResponse.json({
      referral: {
        ...referral,
        createdAt: referral.createdAt.toISOString(),
        convertedAt: referral.convertedAt?.toISOString() || null,
      },
      message: "Referral created. The referred person will receive a WhatsApp invitation via WABlast.",
    }, { status: 201 });
  } catch (error) {
    console.error("[referrals/create] error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
