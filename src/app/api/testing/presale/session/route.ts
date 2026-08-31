// Author: Klaasvaakie ( |╲ )
import { NextResponse } from "next/server";

const PRESALE_SESSION_COOKIE = "kasishares_session";

export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const body = await request.json().catch(() => null) as { sessionToken?: unknown } | null;
  const sessionToken = typeof body?.sessionToken === "string" ? body.sessionToken.trim() : "";
  if (sessionToken.length < 64 || sessionToken.length > 256) {
    return NextResponse.json({ error: "A valid E2E session token is required" }, { status: 400 });
  }
  const response = NextResponse.json({ ok: true, scope: "presale-e2e" });
  response.cookies.set(PRESALE_SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
    maxAge: 60 * 60 * 2,
  });
  return response;
}
