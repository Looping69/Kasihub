// Author: Klaasvaakie ( |╲ )
import { NextRequest, NextResponse } from "next/server";
import { safeReturnPath, SITE_LOCK_COOKIE, siteLockEnabled, siteLockToken } from "./lib/site-lock";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function externalOrigin(request: NextRequest): string {
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",", 1)[0]?.trim();
  const host = forwardedHost || request.headers.get("host");
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",", 1)[0]?.trim();
  const protocol = forwardedProto || request.nextUrl.protocol.replace(/:$/, "");
  return host ? `${protocol}://${host}` : request.nextUrl.origin;
}

export async function proxy(request: NextRequest) {
  const isApi = request.nextUrl.pathname.startsWith("/api/");
  if (!isApi && siteLockEnabled() && request.nextUrl.pathname !== "/site-lock") {
    const expected = await siteLockToken();
    if (!expected || request.cookies.get(SITE_LOCK_COOKIE)?.value !== expected) {
      const lockUrl = new URL("/site-lock", request.url);
      lockUrl.searchParams.set("next", safeReturnPath(`${request.nextUrl.pathname}${request.nextUrl.search}`));
      return NextResponse.redirect(lockUrl);
    }
  }

  if (!isApi || SAFE_METHODS.has(request.method)) return NextResponse.next();

  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (!origin || origin !== externalOrigin(request) || (fetchSite && fetchSite !== "same-origin")) {
    return NextResponse.json({ error: "Cross-site request rejected" }, { status: 403 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png|manifest.webmanifest|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|woff2?|pdf)$).*)"],
};
