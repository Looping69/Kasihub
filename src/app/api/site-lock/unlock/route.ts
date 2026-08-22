// Author: Klaasvaakie ( |╲ )
import { NextRequest, NextResponse } from "next/server";
import { safeReturnPath, SITE_LOCK_COOKIE, siteLockEnabled, siteLockToken } from "@/lib/site-lock";

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const next = safeReturnPath(typeof form.get("next") === "string" ? form.get("next") as string : null);
  const pin = typeof form.get("pin") === "string" ? form.get("pin") as string : "";
  if (!siteLockEnabled() || pin !== process.env.SITE_LOCK_PIN) {
    const failure = new URL("/site-lock", request.url);
    failure.searchParams.set("error", "1");
    failure.searchParams.set("next", next);
    return NextResponse.redirect(failure, 303);
  }
  const token = await siteLockToken();
  if (!token) return NextResponse.json({ error: "Site lock is not configured" }, { status: 503 });
  const response = NextResponse.redirect(new URL(next, request.url), 303);
  response.cookies.set(SITE_LOCK_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return response;
}
