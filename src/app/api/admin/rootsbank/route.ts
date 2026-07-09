import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/admin/rootsbank - all pioneer shares across platform
export async function GET() {
  try {
    const pioneers = await db.rootsBankShare.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        member: {
          select: { profileNumber: true, firstName: true, lastName: true, companyName: true, email: true, country: true },
        },
      },
    });

    const categoryBreakdown = {
      KIDS_STUDENT: pioneers.filter((p) => p.category === "KIDS_STUDENT").length,
      ADULT: pioneers.filter((p) => p.category === "ADULT").length,
      PENSIONER: pioneers.filter((p) => p.category === "PENSIONER").length,
    };

    const totalCollected = pioneers.reduce((s, p) => s + p.totalAmount, 0);

    // Pioneer pool payouts (transactions of type PIONEER)
    const pioneerPayouts = await db.transaction.findMany({
      where: { type: "PIONEER" },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { member: { select: { profileNumber: true, firstName: true, lastName: true } } },
    });

    return NextResponse.json({
      pioneers: pioneers.map((p) => ({
        ...p,
        createdAt: p.createdAt.toISOString(),
        member: {
          profileNumber: p.member.profileNumber,
          name: p.member.companyName || `${p.member.firstName} ${p.member.lastName}`,
          email: p.member.email,
          country: p.member.country,
        },
      })),
      categoryBreakdown,
      totalCollected: parseFloat(totalCollected.toFixed(2)),
      pioneerTarget: 200,
      remaining: 200 - pioneers.length,
      pioneerPayouts: pioneerPayouts.map((t) => ({
        ...t,
        createdAt: t.createdAt.toISOString(),
        member: {
          profileNumber: t.member.profileNumber,
          name: `${t.member.firstName} ${t.member.lastName}`,
        },
      })),
    });
  } catch (error) {
    console.error("[admin/rootsbank] error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
