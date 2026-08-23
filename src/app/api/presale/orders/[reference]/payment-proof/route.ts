// Author: Klaasvaakie ( |╲ )
import { NextRequest, NextResponse } from "next/server";
import { EncoreRequestError, encoreRequest, encoreSessionToken } from "@/lib/encore-client";

export async function POST(req: NextRequest, context: { params: Promise<{ reference: string }> }) {
  const { reference } = await context.params;
  try {
    const body = await req.json();
    const token = await encoreSessionToken();
    if (!token) return NextResponse.json({ error: "Authentication is required" }, { status: 401 });
    return NextResponse.json(await encoreRequest(`/presale/orders/${encodeURIComponent(reference)}/payment-proof`, {
      method: "POST",
      body: JSON.stringify({ ...body, orderReference: reference }),
    }, token));
  } catch (error) {
    const status = error instanceof EncoreRequestError ? error.status : 500;
    return NextResponse.json({ error: "Unable to submit the transaction hash" }, { status });
  }
}
