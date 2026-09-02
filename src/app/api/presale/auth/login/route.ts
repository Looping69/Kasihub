// Author: Klaasvaakie ( |╲ )
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { EncoreRequestError, encoreRequest, PRESALE_SESSION_COOKIE } from "@/lib/encore-client";

type LoginResponse = { token: string; profileId: string; profileNumber: string };
const loginInput = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(128),
});

export async function POST(request: NextRequest) {
  try {
    const parsed = loginInput.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Enter a valid email address and password." }, { status: 400 });
    }
    const login = await encoreRequest<LoginResponse>("/presale/auth/login", {
      method: "POST",
      body: JSON.stringify(parsed.data),
    });
    const response = NextResponse.json({ profileId: login.profileId, profileNumber: login.profileNumber });
    response.cookies.set(PRESALE_SESSION_COOKIE, login.token, {
      httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production",
      path: "/", maxAge: 60 * 60 * 24 * 7,
    });
    return response;
  } catch (error) {
    const status = error instanceof EncoreRequestError ? error.status : 500;
    const message = status === 400
      ? "Enter a valid email address and password."
      : status === 401
        ? "The email or password is incorrect."
        : "KaSiShares login is temporarily unavailable.";
    return NextResponse.json({ error: message }, { status });
  }
}
