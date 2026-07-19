// Author: Klaasvaakie ( |╲ )
import { NextRequest, NextResponse } from "next/server";
import {
  ENCORE_SESSION_COOKIE,
  EncoreRequestError,
  encoreRequest,
} from "@/lib/encore-client";
import type { Member } from "@/lib/types";

type LoginResponse = { token: string };
type ProfileResponse = { member: Member };

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { email?: string; password?: string; demoRole?: "member" | "admin" };
  if (body.demoRole) {
    const isAdmin = body.demoRole === "admin";
    const email = process.env[isAdmin ? "KASIHUB_DEMO_ADMIN_EMAIL" : "KASIHUB_DEMO_MEMBER_EMAIL"];
    const password = process.env[isAdmin ? "KASIHUB_DEMO_ADMIN_PASSWORD" : "KASIHUB_DEMO_MEMBER_PASSWORD"];
    if (!email || !password) {
      return NextResponse.json({ error: "Demo access is not configured. Use a registered account." }, { status: 503 });
    }
    return authenticate(email, password, isAdmin);
  }
  if (!body.email || !body.password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }
  return authenticate(body.email, body.password, false);
}

async function authenticate(email: string, password: string, requireAdmin: boolean) {
  try {
    const login = await encoreRequest<LoginResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    const profile = await encoreRequest<ProfileResponse>("/profiles/me", {}, login.token);
    if (requireAdmin && !profile.member.isAdmin) {
      return NextResponse.json({ error: "Administrator access required" }, { status: 403 });
    }
    const response = NextResponse.json({ member: profile.member });
    response.cookies.set(ENCORE_SESSION_COOKIE, login.token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return response;
  } catch (error) {
    const status = error instanceof EncoreRequestError ? error.status : 500;
    return NextResponse.json(
      { error: status === 401 ? "Invalid email or password" : "Unable to sign in through Encore" },
      { status },
    );
  }
}
