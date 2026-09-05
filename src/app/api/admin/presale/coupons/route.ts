import { NextRequest, NextResponse } from "next/server";
import { EncoreRequestError, encoreRequest, encoreSessionToken } from "@/lib/encore-client";
export async function POST(req: NextRequest) {
  const token = await encoreSessionToken();
  if (!token) return NextResponse.json({ error: "Sign in to continue" }, { status: 401 });
  try {
    return NextResponse.json(await encoreRequest("/admin/presale/coupons", { method: "POST", body: JSON.stringify(await req.json()) }, token), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof EncoreRequestError ? error.status : 500;
    const details = error instanceof EncoreRequestError ? error.details as { message?: string } : null;
    return NextResponse.json({ error: status < 500 && typeof details?.message === "string" ? details.message : "Unable to process coupon request" }, { status });
  }
}
