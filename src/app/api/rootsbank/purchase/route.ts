// Author: Klaasvaakie ( |╲ )
import { NextRequest, NextResponse } from "next/server";
import { EncoreRequestError, encoreRequest, encoreSessionToken } from "@/lib/encore-client";

export async function POST(req: NextRequest) {
  const token = await encoreSessionToken();
  if (!token) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const body = await req.json();
  const idempotencyKey = req.headers.get("idempotency-key");
  if (!body.memberId || !["KIDS_STUDENT", "ADULT", "PENSIONER"].includes(body.category)) {
    return NextResponse.json({ error: "A member and valid category are required" }, { status: 400 });
  }
  if (!idempotencyKey) return NextResponse.json({ error: "Idempotency-Key is required" }, { status: 400 });
  try {
    return NextResponse.json(await encoreRequest(
      "/rootsbank/purchase",
      { method: "POST", headers: { "Idempotency-Key": idempotencyKey }, body: JSON.stringify({ profileId: body.memberId, category: body.category, paymentRef: body.paymentRef }) },
      token,
    ));
  } catch (error) {
    const status = error instanceof EncoreRequestError ? error.status : 500;
    return NextResponse.json({ error: "Encore RootsBank purchase failed" }, { status });
  }
}
