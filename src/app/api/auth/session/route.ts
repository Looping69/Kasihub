// Author: Klaasvaakie ( |╲ )
import { NextResponse } from "next/server";
import { ENCORE_SESSION_COOKIE, EncoreRequestError, encoreRequest, encoreSessionToken } from "@/lib/encore-client";
import type { Member } from "@/lib/types";

export async function GET() {
  const token = await encoreSessionToken();
  if (!token) return NextResponse.json({ authenticated: false, member: null });
  try {
    const profile = await encoreRequest<{ member: Member }>("/profiles/me", {}, token);
    return NextResponse.json({ authenticated: true, member: profile.member });
  } catch (error) {
    const status = error instanceof EncoreRequestError ? error.status : 500;
    const response = NextResponse.json({ authenticated: false, member: null }, { status: status >= 500 ? 503 : 200 });
    if (status === 401 || status === 403) response.cookies.delete(ENCORE_SESSION_COOKIE);
    return response;
  }
}
