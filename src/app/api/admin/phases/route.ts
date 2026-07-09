import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// PATCH /api/admin/phases - update a share phase (price, totalShares, status, bonus)
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { phaseId, pricePerShare, totalShares, status, bonusBuyOneGet } = body;

    if (!phaseId) {
      return NextResponse.json({ error: "phaseId is required" }, { status: 400 });
    }

    const existing = await db.sharePhase.findUnique({ where: { id: phaseId } });
    if (!existing) {
      return NextResponse.json({ error: "Phase not found" }, { status: 404 });
    }

    const data: {
      pricePerShare?: number;
      totalShares?: number;
      status?: string;
      bonusBuyOneGet?: boolean;
    } = {};
    if (pricePerShare !== undefined) data.pricePerShare = parseFloat(pricePerShare);
    if (totalShares !== undefined) data.totalShares = parseInt(totalShares);
    if (status !== undefined) data.status = status;
    if (bonusBuyOneGet !== undefined) data.bonusBuyOneGet = bonusBuyOneGet;

    const updated = await db.sharePhase.update({
      where: { id: phaseId },
      data,
    });

    return NextResponse.json({
      phase: { ...updated, createdAt: updated.createdAt.toISOString(), updatedAt: updated.updatedAt.toISOString() },
    });
  } catch (error) {
    console.error("[admin/phases] error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
