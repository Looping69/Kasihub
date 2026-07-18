// Author: Klaasvaakie ( |╲ )
import { NextRequest, NextResponse } from "next/server";
import { EncoreRequestError, encoreRequest, encoreSessionToken } from "@/lib/encore-client";

type Share = { quantity: number; totalAmount: number; profileId: string } & Record<string, unknown>;

export async function GET(req: NextRequest) {
  const token = await encoreSessionToken();
  if (!token) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get("limit") ?? 50), 1), 500);
  try {
    const { shares } = await encoreRequest<{ shares: Share[] }>(`/admin/shares?limit=${limit}`, {}, token);
    return NextResponse.json({
      shares: shares.map((share) => ({ ...share, member: { profileNumber: `KSI-${share.profileId.slice(0, 8).toUpperCase()}`, name: "Encore member", email: "" } })),
      totalActiveShares: shares.reduce((sum, share) => sum + share.quantity, 0),
      totalActiveValue: shares.reduce((sum, share) => sum + share.totalAmount, 0),
    });
  } catch (error) {
    const status = error instanceof EncoreRequestError ? error.status : 500;
    return NextResponse.json({ error: "Unable to load Encore shares administration" }, { status });
  }
}
