// Author: Klaasvaakie ( |╲ )
import { NextRequest, NextResponse } from "next/server";
import { EncoreRequestError, encoreRequest, encoreSessionToken } from "@/lib/encore-client";

export async function POST(req: NextRequest) {
  return queue(req, "active");
}

async function queue(req: NextRequest, mode: string) {
  const token = await encoreSessionToken();
  if (!token) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const { memberId } = await req.json();
  if (!memberId) return NextResponse.json({ error: "memberId is required" }, { status: 400 });
  try {
    return NextResponse.json(await encoreRequest(`/vouchers/${encodeURIComponent(memberId)}/delivery`, { method: "POST", body: JSON.stringify({ mode }) }, token));
  } catch (error) {
    const status = error instanceof EncoreRequestError ? error.status : 500;
    return NextResponse.json({ error: "Unable to queue voucher delivery" }, { status });
  }
}
