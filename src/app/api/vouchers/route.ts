import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/vouchers?memberId=xxx - get member's vouchers
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const memberId = searchParams.get("memberId");
    if (!memberId) {
      return NextResponse.json({ error: "memberId is required" }, { status: 400 });
    }

    const vouchers = await db.voucher.findMany({
      where: { memberId },
      orderBy: { expiryDate: "asc" },
    });

    const now = new Date();
    const active = vouchers.filter((v) => v.status === "ACTIVE" && new Date(v.expiryDate) > now);
    const expiringSoon = active.filter((v) => {
      const days = Math.ceil((new Date(v.expiryDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return days <= 5;
    });
    const expired = vouchers.filter((v) => v.status === "EXPIRED" || new Date(v.expiryDate) <= now);

    const totalValue = active.reduce((s, v) => s + v.value, 0);

    return NextResponse.json({
      vouchers: vouchers.map((v) => ({
        ...v,
        issueDate: v.issueDate.toISOString(),
        expiryDate: v.expiryDate.toISOString(),
        anniversaryDate: v.anniversaryDate?.toISOString() || null,
        createdAt: v.createdAt.toISOString(),
        daysToExpiry: Math.ceil((new Date(v.expiryDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
      })),
      active: active.length,
      expiringSoon: expiringSoon.length,
      expired: expired.length,
      totalValue: parseFloat(totalValue.toFixed(2)),
    });
  } catch (error) {
    console.error("[vouchers] error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
