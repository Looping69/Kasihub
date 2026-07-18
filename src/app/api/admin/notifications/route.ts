// Author: Klaasvaakie ( |╲ )
import { NextRequest, NextResponse } from "next/server";
import { EncoreRequestError, encoreRequest, encoreSessionToken } from "@/lib/encore-client";

type Notification = { memberId: string; daysBefore: number } & Record<string, unknown>;

export async function GET() {
  const token = await encoreSessionToken();
  if (!token) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  try {
    const data = await encoreRequest<{ notifications: Notification[]; activeMembers: number }>("/admin/subscription-notifications", {}, token);
    return NextResponse.json({ notifications: data.notifications.map((notification) => ({ ...notification, member: { profileNumber: `KSI-${notification.memberId.slice(0, 8).toUpperCase()}`, name: "Encore member", mobile: "" } })), stats: { total: data.notifications.length, sent5Days: data.notifications.filter((notification) => notification.daysBefore === 5).length, sent3Days: data.notifications.filter((notification) => notification.daysBefore === 3).length, sent1Day: data.notifications.filter((notification) => notification.daysBefore === 1).length, activeMembers: data.activeMembers } });
  } catch (error) { return failure(error); }
}

export async function POST(req: NextRequest) {
  const token = await encoreSessionToken();
  if (!token) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const { daysBefore } = await req.json();
  if (![1, 3, 5].includes(daysBefore)) return NextResponse.json({ error: "daysBefore must be 1, 3, or 5" }, { status: 400 });
  try { return NextResponse.json(await encoreRequest("/admin/subscription-notifications", { method: "POST", body: JSON.stringify({ daysBefore }) }, token)); }
  catch (error) { return failure(error); }
}

function failure(error: unknown) { const status = error instanceof EncoreRequestError ? error.status : 500; return NextResponse.json({ error: "Encore notification operation failed" }, { status }); }
