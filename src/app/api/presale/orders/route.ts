// Author: Klaasvaakie ( |╲ )
import { NextRequest, NextResponse } from "next/server";
import {
  EncoreRequestError,
  encoreRequest,
  encoreSessionToken,
} from "@/lib/encore-client";

export async function POST(req: NextRequest) {
  const idempotencyKey = req.headers.get("idempotency-key");
  if (!idempotencyKey) return NextResponse.json({ error: "Idempotency-Key is required" }, { status: 400 });
  const token = await encoreSessionToken();
  if (!token) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  try {
    const body = await req.json();
    return NextResponse.json(await encoreRequest("/presale/orders", {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify(body),
    }, token));
  } catch (error) {
    const status = error instanceof EncoreRequestError ? error.status : 500;
    return NextResponse.json({ error: "Unable to create the presale order" }, { status });
  }
}
