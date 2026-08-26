// Author: Klaasvaakie ( |╲ )
import { NextRequest, NextResponse } from "next/server";
import { EncoreRequestError, encoreRequest, encoreSessionToken } from "@/lib/encore-client";

type Share = {
  id: string; profileId: string; profileNumber: string; holderName: string; email: string; country: string;
  phase: number; pricePerShare: number; quantity: number; purchasedQuantity: number; bonusQuantity: number;
  totalAmount: number; currency: string; certificateNo: string; status: string; createdAt: string;
  revokedAt: string | null; source: string; orderReference: string | null; campaignName: string | null;
};

type ShareRegisterResponse = {
  shares: Share[];
  summary: { registerEntries: number; shareholderCount: number; certificateCount: number; issuedShares: number; revokedShares: number };
};

export async function GET(req: NextRequest) {
  const token = await encoreSessionToken();
  if (!token) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get("limit") ?? 50), 1), 500);
  try {
    const { shares, summary } = await encoreRequest<ShareRegisterResponse>(`/admin/shares?limit=${limit}`, {}, token);
    return NextResponse.json({
      shares,
      summary,
      totalActiveShares: summary.issuedShares,
      totalActiveValue: shares.filter((share) => share.status === "ISSUED").reduce((sum, share) => sum + share.totalAmount, 0),
    });
  } catch (error) {
    const status = error instanceof EncoreRequestError ? error.status : 500;
    return NextResponse.json({ error: "Unable to load Encore shares administration" }, { status });
  }
}
