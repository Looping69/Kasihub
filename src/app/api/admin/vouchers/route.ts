import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/admin/vouchers - all vouchers across the platform
export async function GET() {
  try {
    const vouchers = await db.voucher.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        member: {
          select: { profileNumber: true, firstName: true, lastName: true, companyName: true, mobile: true },
        },
      },
    });

    const now = new Date();
    const active = vouchers.filter((v) => v.status === "ACTIVE" && new Date(v.expiryDate) > now);
    const expired = vouchers.filter((v) => v.status === "EXPIRED" || new Date(v.expiryDate) <= now);
    const expiringSoon = active.filter((v) => {
      const days = Math.ceil((new Date(v.expiryDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return days <= 5;
    });
    const wablastPushed = vouchers.filter((v) => v.wablastSent).length;
    const expiringPushed = vouchers.filter((v) => v.expiringSent).length;
    const totalValue = active.reduce((s, v) => s + v.value, 0);

    // Category breakdown
    const categoryMap = new Map<string, { count: number; value: number }>();
    for (const v of active) {
      const cur = categoryMap.get(v.category) || { count: 0, value: 0 };
      cur.count++;
      cur.value += v.value;
      categoryMap.set(v.category, cur);
    }
    const categoryStats = Array.from(categoryMap.entries()).map(([category, stats]) => ({
      category,
      count: stats.count,
      value: parseFloat(stats.value.toFixed(2)),
    }));

    return NextResponse.json({
      vouchers: vouchers.map((v) => ({
        ...v,
        issueDate: v.issueDate.toISOString(),
        expiryDate: v.expiryDate.toISOString(),
        anniversaryDate: v.anniversaryDate?.toISOString() || null,
        createdAt: v.createdAt.toISOString(),
        daysToExpiry: Math.ceil((new Date(v.expiryDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
        member: {
          profileNumber: v.member.profileNumber,
          name: v.member.companyName || `${v.member.firstName} ${v.member.lastName}`,
          mobile: v.member.mobile,
        },
      })),
      stats: {
        total: vouchers.length,
        active: active.length,
        expired: expired.length,
        expiringSoon: expiringSoon.length,
        wablastPushed,
        expiringPushed,
        totalValue: parseFloat(totalValue.toFixed(2)),
      },
      categoryStats,
    });
  } catch (error) {
    console.error("[admin/vouchers] error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
