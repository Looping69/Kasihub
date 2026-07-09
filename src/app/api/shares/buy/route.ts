import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST /api/shares/buy - purchase shares in a phase
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { memberId, phase, quantity } = body;

    if (!memberId || !phase || !quantity || quantity < 1) {
      return NextResponse.json({ error: "memberId, phase, and quantity (>=1) are required" }, { status: 400 });
    }

    const phaseRec = await db.sharePhase.findUnique({ where: { phase: parseInt(phase) } });
    if (!phaseRec) {
      return NextResponse.json({ error: "Phase not found" }, { status: 404 });
    }
    if (phaseRec.status !== "OPEN") {
      return NextResponse.json({ error: `Phase ${phase} is not open for purchase` }, { status: 400 });
    }

    const remaining = phaseRec.totalShares - phaseRec.soldShares;
    if (quantity > remaining) {
      return NextResponse.json(
        { error: `Only ${remaining} shares remaining in Phase ${phase}` },
        { status: 400 }
      );
    }

    const pricePerShare = phaseRec.pricePerShare;
    const totalAmount = pricePerShare * quantity;

    // Determine effective quantity (BOGO in phase 1)
    const effectiveQty = phaseRec.bonusBuyOneGet ? quantity * 2 : quantity;

    // Generate certificate number
    const certCount = await db.share.count();
    const certificateNo = `KSH-CERT-2025-${String(certCount + 1).padStart(6, "0")}`;

    // If member has existing certificates, revoke the latest and reference it
    const prevShare = await db.share.findFirst({
      where: { memberId, status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
    });
    let prevCertNo: string | null = null;
    if (prevShare) {
      await db.share.update({
        where: { id: prevShare.id },
        data: { status: "REVOKED" },
      });
      prevCertNo = prevShare.certificateNo;
    }

    const share = await db.share.create({
      data: {
        memberId,
        phase: parseInt(phase),
        pricePerShare,
        quantity: effectiveQty,
        totalAmount,
        certificateNo,
        prevCertificateNo: prevCertNo,
        status: "ACTIVE",
      },
    });

    // Update phase sold count
    await db.sharePhase.update({
      where: { phase: parseInt(phase) },
      data: { soldShares: phaseRec.soldShares + quantity },
    });

    // Record transaction
    await db.transaction.create({
      data: {
        memberId,
        type: "SHARE_PURCHASE",
        amount: -totalAmount,
        description: `${quantity} x KasiShares Phase ${phase} ($${pricePerShare} each)${phaseRec.bonusBuyOneGet ? " (BOGO - " + effectiveQty + " shares issued)" : ""}`,
        status: "COMPLETED",
      },
    });

    return NextResponse.json({
      share: { ...share, createdAt: share.createdAt.toISOString() },
      certificateNo,
      effectiveQuantity: effectiveQty,
    });
  } catch (error) {
    console.error("[shares/buy] error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
