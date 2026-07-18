// Author: Klaasvaakie ( |╲ )
import { NextRequest, NextResponse } from "next/server";
import { EncoreRequestError, encoreRequest, encoreSessionToken } from "@/lib/encore-client";

export async function GET(req: NextRequest) {
  const memberId = req.nextUrl.searchParams.get("memberId");
  const links = {
    androidUrl: process.env.INSTAPAY_ANDROID_URL ?? "https://play.google.com/store/apps/instapay-gini",
    iosUrl: process.env.INSTAPAY_IOS_URL ?? "https://apps.apple.com/instapay-gini",
  };
  if (!memberId) return NextResponse.json({ status: "NONE", accountRef: null, ...links });
  const token = await encoreSessionToken();
  if (!token) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  try {
    const status = await encoreRequest<{ status: string; accountRef: string | null }>(`/kyc/status/${encodeURIComponent(memberId)}`, {}, token);
    return NextResponse.json({ ...status, ...links });
  } catch (error) {
    const status = error instanceof EncoreRequestError ? error.status : 500;
    return NextResponse.json({ error: "Unable to load verification status from Encore" }, { status });
  }
}
