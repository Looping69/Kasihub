// Author: Klaasvaakie ( |╲ )
import { NextRequest, NextResponse } from "next/server";
import { EncoreRequestError, encoreRequest, presaleSessionToken } from "@/lib/encore-client";

export async function POST(req: NextRequest, context: { params: Promise<{ reference: string }> }) {
  const { reference } = await context.params;
  const accessToken = req.headers.get("x-presale-access-token")?.trim();
  const sessionToken = await presaleSessionToken();
  if (!accessToken && !sessionToken) {
    return NextResponse.json({ error: "Order access token or session login is required" }, { status: 401 });
  }
  try {
    const headers: Record<string, string> = {};
    if (accessToken) headers["X-Presale-Access-Token"] = accessToken;
    return NextResponse.json(await encoreRequest(
      `/presale/orders/${encodeURIComponent(reference)}/webpay-checkout`,
      { method: "POST", headers },
      sessionToken,
    ));
  } catch (error) {
    const status = error instanceof EncoreRequestError ? error.status : 500;
    return NextResponse.json(
      { error: status === 503 ? "WebPay checkout is not configured" : "Unable to start WebPay checkout" },
      { status },
    );
  }
}
