// Author: Klaasvaakie ( |╲ )
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ENCORE_SESSION_COOKIE, encoreRequest } from "@/lib/encore-client";

export async function GET() {
  return logout();
}

export async function POST() {
  return logout();
}

async function logout() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ENCORE_SESSION_COOKIE)?.value;
  if (token) {
    try {
      await encoreRequest("/auth/logout", { method: "POST" }, token);
    } catch {
      // The local cookie is still cleared if the upstream session is already unavailable.
    }
  }
  const response = NextResponse.json({ success: true });
  response.cookies.set(ENCORE_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}
