// Author: Klaasvaakie ( |╲ )
import { NextRequest, NextResponse } from "next/server";
import { EncoreRequestError, encoreRequest, PRESALE_SESSION_COOKIE } from "@/lib/encore-client";

type LoginResponse = { token: string; profileId: string; profileNumber: string };

export async function POST(request: NextRequest) {
  try {
    const login = await encoreRequest<LoginResponse>("/presale/auth/login", {
      method: "POST",
      body: JSON.stringify(await request.json()),
    });
    const response = NextResponse.json({ profileId: login.profileId, profileNumber: login.profileNumber });
    response.cookies.set(PRESALE_SESSION_COOKIE, login.token, {
      httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production",
      path: "/", maxAge: 60 * 60 * 24 * 7,
    });
    return response;
  } catch (error) {
    const status = error instanceof EncoreRequestError ? error.status : 500;
    return NextResponse.json({ error: status === 401 ? "The email or password is incorrect." : "KaSiShares login is temporarily unavailable." }, { status });
  }
}
