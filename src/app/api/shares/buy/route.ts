// Author: Klaasvaakie ( |╲ )
import { NextRequest, NextResponse } from "next/server";
import { EncoreRequestError, encoreRequest, encoreSessionToken } from "@/lib/encore-client";

type PurchaseResponse = {
  purchaseId: string;
  status: string;
  totalAmount: string;
  bonusQuantity: number;
  certificateNumber: string;
  operationId: string;
};

export async function POST(req: NextRequest) {
  const token = await encoreSessionToken();
  if (!token) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const body = await req.json();
  const idempotencyKey = req.headers.get("idempotency-key");
  const phase = Number(body.phase);
  const quantity = Number(body.quantity);
  if (!body.memberId || !Number.isInteger(phase) || !Number.isInteger(quantity) || quantity < 1) {
    return NextResponse.json({ error: "memberId, phase and a positive quantity are required" }, { status: 400 });
  }
  if (!idempotencyKey) {
    return NextResponse.json({ error: "Idempotency-Key is required" }, { status: 400 });
  }
  try {
    const purchase = await encoreRequest<PurchaseResponse>(
      "/shares/purchase",
      {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
        body: JSON.stringify({ profileId: body.memberId, phaseNumber: phase, quantity }),
      },
      token,
    );
    return NextResponse.json({
      share: {
        id: purchase.purchaseId,
        phase,
        quantity: quantity + purchase.bonusQuantity,
        totalAmount: Number(purchase.totalAmount),
        certificateNo: purchase.certificateNumber,
        status: purchase.status.toUpperCase(),
        createdAt: new Date().toISOString(),
      },
      certificateNo: purchase.certificateNumber,
      effectiveQuantity: quantity + purchase.bonusQuantity,
      operationId: purchase.operationId,
      status: purchase.status,
    });
  } catch (error) {
    const status = error instanceof EncoreRequestError ? error.status : 500;
    return NextResponse.json({ error: "Encore share purchase failed" }, { status });
  }
}
