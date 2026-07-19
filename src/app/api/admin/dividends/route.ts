// Author: Klaasvaakie ( |╲ )
import { NextRequest, NextResponse } from "next/server";
import { EncoreRequestError, encoreRequest, encoreSessionToken } from "@/lib/encore-client";

export async function POST(req: NextRequest) {
  const token = await encoreSessionToken();
  if (!token) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const { amount } = await req.json();
  const idempotencyKey = req.headers.get("idempotency-key");
  if (!(Number(amount) > 0)) return NextResponse.json({ error: "A positive amount is required" }, { status: 400 });
  if (!idempotencyKey) return NextResponse.json({ error: "Idempotency-Key is required" }, { status: 400 });
  try {
    return NextResponse.json(await encoreRequest("/admin/dividends", { method: "POST", headers: { "Idempotency-Key": idempotencyKey }, body: JSON.stringify({ amount: Number(amount) }) }, token));
  } catch (error) {
    const status = error instanceof EncoreRequestError ? error.status : 500;
    return NextResponse.json({ error: "Encore dividend distribution failed" }, { status });
  }
}
