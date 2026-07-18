// Author: Klaasvaakie ( |╲ )
import { NextRequest, NextResponse } from "next/server";
import { EncoreRequestError, encoreRequest, encoreSessionToken } from "@/lib/encore-client";

type Voucher = { value: number; status: string; expiryDate: string } & Record<string, unknown>;

export async function GET(req: NextRequest) {
  const memberId = req.nextUrl.searchParams.get("memberId");
  const token = await encoreSessionToken();
  if (!memberId) return NextResponse.json({ error: "memberId is required" }, { status: 400 });
  if (!token) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  try {
    const { vouchers } = await encoreRequest<{ vouchers: Voucher[] }>(`/vouchers/${encodeURIComponent(memberId)}`, {}, token);
    const now = Date.now();
    const decorated = vouchers.map((voucher) => ({
      ...voucher,
      daysToExpiry: Math.ceil((new Date(voucher.expiryDate).getTime() - now) / 86400000),
      daysToAnniversary: typeof voucher.anniversaryDate === "string"
        ? Math.ceil((new Date(voucher.anniversaryDate).getTime() - now) / 86400000)
        : null,
    }));
    const active = decorated.filter((voucher) => voucher.status === "ACTIVE" && new Date(voucher.expiryDate).getTime() > now);
    return NextResponse.json({ vouchers: decorated, active: active.length, expiringSoon: active.filter((voucher) => voucher.daysToAnniversary !== null && voucher.daysToAnniversary > 0 && voucher.daysToAnniversary <= 5).length, expired: decorated.length - active.length, totalValue: active.reduce((sum, voucher) => sum + voucher.value, 0) });
  } catch (error) {
    const status = error instanceof EncoreRequestError ? error.status : 500;
    return NextResponse.json({ error: "Unable to load Encore vouchers" }, { status });
  }
}
