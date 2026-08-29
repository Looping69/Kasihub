import { NextRequest, NextResponse } from "next/server";
import { EncoreRequestError, encoreRequest } from "@/lib/encore-client";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    await encoreRequest("/auth/password-reset/complete", { method: "POST", body: JSON.stringify(body) });
    return NextResponse.json({ reset: true });
  } catch (error) {
    const status = error instanceof EncoreRequestError && error.status === 400 ? 400 : 503;
    return NextResponse.json({ error: status === 400 ? "This reset link is invalid, expired, or the password does not meet the requirements." : "Password reset is temporarily unavailable." }, { status });
  }
}
