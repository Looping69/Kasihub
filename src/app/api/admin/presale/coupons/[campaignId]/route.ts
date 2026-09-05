import { NextRequest, NextResponse } from "next/server";
import { EncoreRequestError, encoreRequest, encoreSessionToken } from "@/lib/encore-client";
export async function GET(_req: NextRequest, context: { params: Promise<{ campaignId: string }> }) {
  const token = await encoreSessionToken();
  if (!token) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const { campaignId } = await context.params;
  try { return NextResponse.json(await encoreRequest(`/admin/presale/coupons/${encodeURIComponent(campaignId)}`, { method: "GET" },token), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return NextResponse.json({ error: "Unable to process coupon request" }, { status: error instanceof EncoreRequestError ? error.status : 500 }); }
}
