// Author: Klaasvaakie ( |╲ )
import { NextRequest, NextResponse } from "next/server";
import { EncoreRequestError, encoreRequest, presaleSessionToken } from "@/lib/encore-client";

export async function POST(req: NextRequest, context: { params: Promise<{ reference: string }> }) {
  const token = await presaleSessionToken();
  if (!token) return NextResponse.json({ error: "KaSiShares login is required" }, { status: 401 });
  const { reference } = await context.params;
  const body = await req.json().catch(() => null) as { acknowledgeNoPaymentSent?: boolean } | null;
  try {
    return NextResponse.json(await encoreRequest(
      `/presale/orders/${encodeURIComponent(reference)}/cancel`,
      { method: "POST", body: JSON.stringify({ acknowledgeNoPaymentSent: body?.acknowledgeNoPaymentSent === true }) },
      token,
    ));
  } catch (error) {
    const status = error instanceof EncoreRequestError ? error.status : 500;
    const message = status === 400 || status === 409 || status === 412
      ? "This reservation has already expired, changed status, or entered WebPay checkout. Your account status will be refreshed."
      : "The unpaid reservation could not be cancelled.";
    return NextResponse.json({ error: message }, { status });
  }
}
