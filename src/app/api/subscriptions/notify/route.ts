// Author: Klaasvaakie ( |╲ )
import { NextRequest, NextResponse } from "next/server";
import { EncoreRequestError, encoreRequest, encoreSessionToken } from "@/lib/encore-client";

type Notification = { daysBefore: number } & Record<string, unknown>;

export async function GET(req: NextRequest) {
  const memberId = req.nextUrl.searchParams.get("memberId");
  const token = await encoreSessionToken();
  if (!memberId) return NextResponse.json({ error: "memberId is required" }, { status: 400 });
  if (!token) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  try {
    const { notifications } = await encoreRequest<{ notifications: Notification[] }>(`/subscriptions/${encodeURIComponent(memberId)}/notifications`, {}, token);
    return NextResponse.json({ notifications, sent5Days: notifications.some((notification) => notification.daysBefore === 5), sent3Days: notifications.some((notification) => notification.daysBefore === 3), sent1Day: notifications.some((notification) => notification.daysBefore === 1) });
  } catch (error) { return failure(error); }
}

export async function POST(req: NextRequest) {
  const token = await encoreSessionToken();
  if (!token) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const body = await req.json();
  if (!body.memberId || ![1, 3, 5].includes(body.daysBefore)) return NextResponse.json({ error: "memberId and daysBefore are required" }, { status: 400 });
  try {
    const data = await encoreRequest<{ queued: boolean; notification: unknown }>(`/subscriptions/${encodeURIComponent(body.memberId)}/notifications`, { method: "POST", body: JSON.stringify({ daysBefore: body.daysBefore }) }, token);
    return NextResponse.json({ sent: false, queued: data.queued, notification: data.notification, message: data.queued ? "Renewal reminder queued for delivery." : "This reminder was already queued." });
  } catch (error) { return failure(error); }
}

function failure(error: unknown) { const status = error instanceof EncoreRequestError ? error.status : 500; return NextResponse.json({ error: "Encore notification operation failed" }, { status }); }
