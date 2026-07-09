import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/rootsbank?memberId=xxx - get roots bank pioneer info
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const memberId = searchParams.get("memberId");

    // Bank details (constant)
    const bankDetails = {
      bankName: "Solidus Holdings (Pty) Ltd",
      bank: "FNB",
      accountType: "Gold Business Account",
      accountNumber: "63212306319",
      branchCode: "210835",
      reference: memberId ? `KSH-${memberId.slice(-6).toUpperCase()}` : "KSH-MEMBER",
    };

    // Count pioneer registrations
    const pioneerCount = await db.rootsBankShare.count();
    const pioneerTarget = 200;
    const pioneerProgress = (pioneerCount / pioneerTarget) * 100;

    // Cost breakdown categories
    const categories = [
      {
        key: "KIDS_STUDENT",
        label: "Kids & Students (16-18)",
        sharePrice: 500,
        membershipFee: 50,
        total: 550,
        description: "Ages 16-18 and students who can prove they are studying. 1 share @ R500 + R50 bank membership fee.",
        documents: ["Proof of studies (letter from institution or student card)"],
      },
      {
        key: "ADULT",
        label: "Adults (18-65)",
        sharePrice: 500,
        membershipFee: 200,
        total: 700,
        description: "Ages 18 to 65. 1 share @ R500 + R200 bank membership fee to the Co-Op Bank.",
        documents: ["South African ID or Passport"],
      },
      {
        key: "PENSIONER",
        label: "Pensioners (over 65, or 60+ on SASSA)",
        sharePrice: 500,
        membershipFee: 50,
        total: 550,
        description: "Over 65, or 60+ who can prove they are on SASSA. 1 share @ R500 + R50 bank membership fee.",
        documents: ["South African ID", "SASSA proof (if 60-65)"],
      },
    ];

    let myShare = null;
    if (memberId) {
      const found = await db.rootsBankShare.findFirst({
        where: { memberId },
        orderBy: { createdAt: "desc" },
      });
      if (found) {
        myShare = {
          ...found,
          createdAt: found.createdAt.toISOString(),
        };
      }
    }

    return NextResponse.json({
      bankDetails,
      pioneerCount,
      pioneerTarget,
      pioneerProgress: parseFloat(pioneerProgress.toFixed(1)),
      categories,
      myShare,
    });
  } catch (error) {
    console.error("[rootsbank] error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
