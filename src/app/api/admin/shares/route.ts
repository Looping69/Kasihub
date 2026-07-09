import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/admin/shares - all shares across platform
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "50");

    const shares = await db.share.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        member: {
          select: { profileNumber: true, firstName: true, lastName: true, companyName: true, email: true },
        },
      },
    });

    const totalShares = await db.share.aggregate({
      where: { status: "ACTIVE" },
      _sum: { quantity: true, totalAmount: true },
    });

    return NextResponse.json({
      shares: shares.map((s) => ({
        ...s,
        createdAt: s.createdAt.toISOString(),
        member: {
          profileNumber: s.member.profileNumber,
          name: s.member.companyName || `${s.member.firstName} ${s.member.lastName}`,
          email: s.member.email,
        },
      })),
      totalActiveShares: totalShares._sum.quantity || 0,
      totalActiveValue: totalShares._sum.totalAmount || 0,
    });
  } catch (error) {
    console.error("[admin/shares] error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
