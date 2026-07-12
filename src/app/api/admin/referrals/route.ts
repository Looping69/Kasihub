import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/admin/referrals - all referrals across the platform
export async function GET() {
  try {
    const referrals = await db.referral.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        referrer: {
          select: { profileNumber: true, firstName: true, lastName: true, companyName: true },
        },
      },
    });

    const registered = referrals.filter((r) => r.status === "REGISTERED");
    const pending = referrals.filter((r) => r.status === "PENDING");
    const totalRewards = registered.reduce((s, r) => s + r.rewardAmount, 0);

    // Top referrers
    const referrerMap = new Map<string, { name: string; profileNumber: string; count: number; rewards: number }>();
    for (const r of referrals) {
      if (r.status === "REGISTERED") {
        const key = r.referrerId;
        const name = r.referrer.companyName || `${r.referrer.firstName} ${r.referrer.lastName}`;
        const cur = referrerMap.get(key) || { name, profileNumber: r.referrer.profileNumber, count: 0, rewards: 0 };
        cur.count++;
        cur.rewards += r.rewardAmount;
        referrerMap.set(key, cur);
      }
    }
    const topReferrers = Array.from(referrerMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return NextResponse.json({
      referrals: referrals.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
        convertedAt: r.convertedAt?.toISOString() || null,
        referrer: {
          profileNumber: r.referrer.profileNumber,
          name: r.referrer.companyName || `${r.referrer.firstName} ${r.referrer.lastName}`,
        },
      })),
      stats: {
        total: referrals.length,
        registered: registered.length,
        pending: pending.length,
        conversionRate: referrals.length > 0 ? parseFloat(((registered.length / referrals.length) * 100).toFixed(1)) : 0,
        totalRewards: parseFloat(totalRewards.toFixed(2)),
      },
      topReferrers,
    });
  } catch (error) {
    console.error("[admin/referrals] error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
