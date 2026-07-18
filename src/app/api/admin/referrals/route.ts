// Author: Klaasvaakie ( |╲ )
import { NextResponse } from "next/server";
import { EncoreRequestError, encoreRequest, encoreSessionToken } from "@/lib/encore-client";

type Referral = { referrerId: string; status: string; rewardAmount: number } & Record<string, unknown>;

export async function GET() {
  const token = await encoreSessionToken();
  if (!token) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  try {
    const { referrals } = await encoreRequest<{ referrals: Referral[] }>("/admin/referrals", {}, token);
    const registered = referrals.filter((referral) => referral.status === "REGISTERED");
    const referrers = new Map<string, { name: string; profileNumber: string; count: number; rewards: number }>();
    for (const referral of registered) {
      const entry = referrers.get(referral.referrerId) ?? { name: "Encore member", profileNumber: `KSI-${referral.referrerId.slice(0, 8).toUpperCase()}`, count: 0, rewards: 0 };
      entry.count++;
      entry.rewards += referral.rewardAmount;
      referrers.set(referral.referrerId, entry);
    }
    return NextResponse.json({ referrals: referrals.map((referral) => ({ ...referral, referrer: { profileNumber: `KSI-${referral.referrerId.slice(0, 8).toUpperCase()}`, name: "Encore member" } })), stats: { total: referrals.length, registered: registered.length, pending: referrals.length - registered.length, conversionRate: referrals.length ? Number(((registered.length / referrals.length) * 100).toFixed(1)) : 0, totalRewards: registered.reduce((sum, referral) => sum + referral.rewardAmount, 0) }, topReferrers: Array.from(referrers.values()).sort((left, right) => right.count - left.count).slice(0, 10) });
  } catch (error) {
    const status = error instanceof EncoreRequestError ? error.status : 500;
    return NextResponse.json({ error: "Unable to load Encore referrals" }, { status });
  }
}
