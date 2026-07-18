// Author: Klaasvaakie ( |╲ )
import { NextRequest, NextResponse } from "next/server";
import { EncoreRequestError, encoreRequest, encoreSessionToken } from "@/lib/encore-client";

type Referral = { status: string; rewardAmount: number } & Record<string, unknown>;

export async function GET(req: NextRequest) {
  const memberId = req.nextUrl.searchParams.get("memberId");
  const token = await encoreSessionToken();
  if (!memberId) return NextResponse.json({ error: "memberId is required" }, { status: 400 });
  if (!token) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  try {
    const { referrals } = await encoreRequest<{ referrals: Referral[] }>(`/referrals/${encodeURIComponent(memberId)}`, {}, token);
    return NextResponse.json({ referrals, stats: referralStats(referrals) });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(req: NextRequest) {
  const token = await encoreSessionToken();
  if (!token) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const body = await req.json();
  if (!body.referrerId || !body.referredName || !body.referredEmail || !body.referredMobile) {
    return NextResponse.json({ error: "All referral details are required" }, { status: 400 });
  }
  try {
    return NextResponse.json(await encoreRequest("/referrals", { method: "POST", body: JSON.stringify({ profileId: body.referrerId, referredName: body.referredName, referredEmail: body.referredEmail, referredMobile: body.referredMobile }) }, token), { status: 201 });
  } catch (error) {
    return failure(error);
  }
}

function referralStats(referrals: Referral[]) {
  return { total: referrals.length, registered: referrals.filter((referral) => referral.status === "REGISTERED").length, pending: referrals.filter((referral) => referral.status === "PENDING").length, totalRewards: referrals.filter((referral) => referral.status === "REGISTERED").reduce((sum, referral) => sum + referral.rewardAmount, 0) };
}

function failure(error: unknown) {
  const status = error instanceof EncoreRequestError ? error.status : 500;
  return NextResponse.json({ error: "Encore referral operation failed" }, { status });
}
