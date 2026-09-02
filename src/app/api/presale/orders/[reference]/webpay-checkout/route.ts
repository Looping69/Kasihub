// Author: Klaasvaakie ( |╲ )
import { NextRequest, NextResponse } from "next/server";
import { EncoreRequestError, encoreRequest, presaleSessionToken } from "@/lib/encore-client";

export async function POST(req: NextRequest, context: { params: Promise<{ reference: string }> }) {
  const { reference } = await context.params;
  const authHeader = req.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : authHeader?.trim();
  const token = bearerToken
    || req.headers.get("x-presale-session-token")?.trim()
    || req.cookies.get("kasishares_session")?.value
    || req.cookies.get("kasihub_session")?.value
    || await presaleSessionToken();
  try {
    return NextResponse.json(await encoreRequest(
      `/presale/orders/${encodeURIComponent(reference)}/webpay-checkout`,
      { method: "POST" },
      token,
    ));
  } catch (error) {
    const status = error instanceof EncoreRequestError ? error.status : 500;
    const details = error instanceof EncoreRequestError && error.details && typeof error.details === "object"
      ? (error.details as { message?: unknown; error?: unknown })
      : null;
    const message = typeof details?.message === "string"
      ? details.message
      : typeof details?.error === "string"
        ? details.error
        : status === 503
          ? "WebPay checkout is not configured"
          : "Unable to start WebPay checkout";
    return NextResponse.json(
      { error: message },
      { status },
    );
  }
}
