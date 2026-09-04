// Author: Klaasvaakie ( |╲ )
import { NextRequest, NextResponse } from "next/server";
import { EncoreRequestError, encoreRequest, presaleSessionToken } from "@/lib/encore-client";

export async function POST(req: NextRequest, context: { params: Promise<{ reference: string }> }) {
  const { reference } = await context.params;
  try {
    const body = await req.json();
    const token = await presaleSessionToken();
    const rawAccessToken = typeof body?.accessToken === "string" ? body.accessToken.trim() : undefined;
    const accessToken = rawAccessToken && rawAccessToken.length >= 32 ? rawAccessToken : undefined;
    if (!token && !accessToken) return NextResponse.json({ error: "Authentication is required" }, { status: 401 });
    return NextResponse.json(await encoreRequest(`/presale/orders/${encodeURIComponent(reference)}/payment-proof`, {
      method: "POST",
      body: JSON.stringify({ ...body, orderReference: reference, accessToken }),
    }, token));
  } catch (error) {
    const status = error instanceof EncoreRequestError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Unable to submit the transaction hash";
    return NextResponse.json({ error: message }, { status });
  }
}
