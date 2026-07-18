// Author: Klaasvaakie ( |╲ )
import { NextResponse } from "next/server";
import { EncoreRequestError, encoreRequest, encoreSessionToken } from "@/lib/encore-client";

type Voucher = { value: number; status: string; expiryDate: string } & Record<string, unknown>;

export async function GET() {
  const token = await encoreSessionToken();
  if (!token) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  try {
    const { vouchers } = await encoreRequest<{ vouchers: (Voucher & { memberId: string; category: string; wablastSent: boolean; expiringSent: boolean })[] }>("/admin/vouchers", {}, token);
    const now = Date.now();
    const decorated = vouchers.map((voucher) => ({ ...voucher, daysToExpiry: Math.ceil((new Date(voucher.expiryDate).getTime() - now) / 86400000), member: { profileNumber: `KSI-${voucher.memberId.slice(0, 8).toUpperCase()}`, name: "Encore member", mobile: "" } }));
    const active = decorated.filter((voucher) => voucher.status === "ACTIVE" && new Date(voucher.expiryDate).getTime() > now);
    const categoryMap = new Map<string, { count: number; value: number }>();
    for (const voucher of active) {
      const entry = categoryMap.get(voucher.category) ?? { count: 0, value: 0 };
      entry.count++; entry.value += voucher.value; categoryMap.set(voucher.category, entry);
    }
    return NextResponse.json({ vouchers: decorated, stats: { total: decorated.length, active: active.length, expired: decorated.length - active.length, expiringSoon: active.filter((voucher) => voucher.daysToExpiry <= 5).length, wablastPushed: decorated.filter((voucher) => voucher.wablastSent).length, expiringPushed: decorated.filter((voucher) => voucher.expiringSent).length, totalValue: active.reduce((sum, voucher) => sum + voucher.value, 0) }, categoryStats: Array.from(categoryMap, ([category, stats]) => ({ category, ...stats })) });
  } catch (error) {
    const status = error instanceof EncoreRequestError ? error.status : 500;
    return NextResponse.json({ error: "Unable to load Encore voucher administration" }, { status });
  }
}
