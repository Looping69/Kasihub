import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// PATCH /api/admin/kyc - approve or reject a member's KYC
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { memberId, action } = body; // action: "APPROVE" | "REJECT"

    if (!memberId || !["APPROVE", "REJECT"].includes(action)) {
      return NextResponse.json({ error: "memberId and action (APPROVE|REJECT) are required" }, { status: 400 });
    }

    const member = await db.member.findUnique({ where: { id: memberId } });
    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    const newStatus = action === "APPROVE" ? "VERIFIED" : "REJECTED";
    const updated = await db.member.update({
      where: { id: memberId },
      data: {
        kycStatus: newStatus,
        kycVerifiedAt: action === "APPROVE" ? new Date() : null,
      },
    });

    // Record a transaction log for the KYC action
    await db.transaction.create({
      data: {
        memberId,
        type: "KYC",
        amount: 0,
        description: `KYC ${action === "APPROVE" ? "approved" : "rejected"} by admin`,
        status: "COMPLETED",
      },
    });

    return NextResponse.json({
      member: {
        ...updated,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
        kycVerifiedAt: updated.kycVerifiedAt?.toISOString() || null,
      },
      kycStatus: newStatus,
    });
  } catch (error) {
    console.error("[admin/kyc] error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
