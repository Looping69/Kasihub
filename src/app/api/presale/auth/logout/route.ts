// Author: Klaasvaakie ( |╲ )
import { NextResponse } from "next/server";
import { encoreRequest, presaleSessionToken, PRESALE_SESSION_COOKIE } from "@/lib/encore-client";

export async function POST() {
  const token = await presaleSessionToken();
  if (token) {
    try { await encoreRequest("/presale/auth/logout", { method: "POST" }, token); } catch { /* Cookie removal still terminates this browser session. */ }
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set(PRESALE_SESSION_COOKIE, "", {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production",
    path: "/", maxAge: 0,
  });
  return response;
}
