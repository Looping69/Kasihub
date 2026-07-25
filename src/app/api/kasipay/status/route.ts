// Author: Klaasvaakie ( |╲ )
import { NextRequest, NextResponse } from "next/server";
import { EncoreRequestError, encoreRequest, encoreSessionToken } from "@/lib/encore-client";

export async function GET(req: NextRequest) {
  const memberId = req.nextUrl.searchParams.get("memberId");
  if (!memberId) return NextResponse.json({ status: "NONE", accountRef: null });

  const token = await encoreSessionToken();
  if (!token) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  try {
    const status = await encoreRequest<{ status: string; accountRef: string | null }>(
      `/kyc/status/${encodeURIComponent(memberId)}`,
      {},
      token,
    );
    return NextResponse.json(status);
  } catch (error) {
    const status = error instanceof EncoreRequestError ? error.status : 500;
    return NextResponse.json({ error: "Unable to load KaSiPay verification status from Encore" }, { status });
  }
}
