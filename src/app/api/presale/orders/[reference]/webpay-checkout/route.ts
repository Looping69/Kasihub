// Author: Klaasvaakie ( |╲ )
import { NextRequest, NextResponse } from "next/server";
import { EncoreRequestError, encoreRequest, presaleSessionToken } from "@/lib/encore-client";

export async function POST(req: NextRequest, context: { params: Promise<{ reference: string }> }) {
  const { reference } = await context.params;
  const accessToken = req.headers.get("x-presale-access-token")?.trim();
  if (!accessToken) return NextResponse.json({ error: "Order access token is required" }, { status: 401 });
  const token = await presaleSessionToken();
  if (!token) return NextResponse.json({ error: "KaSiShares login is required" }, { status: 401 });
  try {
    return NextResponse.json(await encoreRequest(
      `/presale/orders/${encodeURIComponent(reference)}/webpay-checkout`,
      { method: "POST", headers: { "X-Presale-Access-Token": accessToken } },
      token,
    ));
  } catch (error) {
    const status = error instanceof EncoreRequestError ? error.status : 500;
    return NextResponse.json(
      { error: status === 503 ? "WebPay checkout is not configured" : "Unable to start WebPay checkout" },
      { status },
    );
  }
}
