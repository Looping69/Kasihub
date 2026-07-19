// Author: Klaasvaakie ( |╲ )
import { NextRequest, NextResponse } from "next/server";
import { EncoreRequestError, encoreRequest, encoreSessionToken } from "@/lib/encore-client";

export async function GET(req: NextRequest) {
  const token = await encoreSessionToken();
  if (!token) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  try {
    const data = await encoreRequest<{ distributions: ({ memberId: string; source: string; amount: number; payoutDate: string } & Record<string, unknown>)[]; totals: Record<string, number>; eligibleMembers: number }>(`/admin/pool?${req.nextUrl.searchParams}`, {}, token);
    const sourceMap = new Map<string, { amount: number; count: number }>();
    for (const distribution of data.distributions) { const entry = sourceMap.get(distribution.source) ?? { amount: 0, count: 0 }; entry.amount += distribution.amount; entry.count++; sourceMap.set(distribution.source, entry); }
    const dailyTrend = Array.from({ length: 14 }, (_, index) => { const date = new Date(); date.setUTCDate(date.getUTCDate() - (13 - index)); return { date: date.toISOString().slice(0, 10), amount: data.distributions.filter((distribution) => distribution.payoutDate.slice(0, 10) === date.toISOString().slice(0, 10)).reduce((sum, distribution) => sum + distribution.amount, 0) }; });
    return NextResponse.json({ ...data, distributions: data.distributions.map((distribution) => ({ ...distribution, member: { profileNumber: `KSI-${distribution.memberId.slice(0, 8).toUpperCase()}`, name: "Encore member" } })), sourceBreakdown: Array.from(sourceMap, ([source, stats]) => ({ source, ...stats })), dailyTrend });
  } catch (error) { return failure(error); }
}

export async function POST(req: NextRequest) {
  const token = await encoreSessionToken();
  if (!token) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const body = await req.json();
  const idempotencyKey = req.headers.get("idempotency-key");
  if (!(Number(body.totalAmount) > 0)) return NextResponse.json({ error: "A positive totalAmount is required" }, { status: 400 });
  if (!idempotencyKey) return NextResponse.json({ error: "Idempotency-Key is required" }, { status: 400 });
  try { return NextResponse.json(await encoreRequest("/admin/pool/distributions", { method: "POST", headers: { "Idempotency-Key": idempotencyKey }, body: JSON.stringify({ totalAmount: Number(body.totalAmount), source: body.source }) }, token)); }
  catch (error) { return failure(error); }
}

function failure(error: unknown) { const status = error instanceof EncoreRequestError ? error.status : 500; return NextResponse.json({ error: "Encore pool operation failed" }, { status }); }
