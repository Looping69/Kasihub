// Author: Klaasvaakie ( |╲ )
import { NextResponse } from "next/server";
import { EncoreRequestError, encoreRequest, presaleSessionToken } from "@/lib/encore-client";

export async function POST(_request: Request, context: { params: Promise<{ reference: string }> }) {
  const token = await presaleSessionToken();
  if (!token) return NextResponse.json({ error: "KaSiShares login is required" }, { status: 401 });
  const { reference } = await context.params;
  try {
    return NextResponse.json(await encoreRequest(
      `/presale/orders/${encodeURIComponent(reference)}/payment-recheck`,
      { method: "POST" },
      token,
    ));
  } catch (error) {
    const status = error instanceof EncoreRequestError ? error.status : 500;
    const message = status === 404
      ? "This reservation could not be found in your KaSiShares account."
      : status === 409 || status === 412
        ? "A transaction hash must be submitted before this crypto payment can be rechecked."
        : "Payment verification is temporarily unavailable. Your submitted hash remains saved and will be retried automatically.";
    return NextResponse.json({ error: message }, { status });
  }
}
