import { NextRequest, NextResponse } from "next/server";
import { EncoreRequestError, encoreRequest } from "@/lib/encore-client";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    await encoreRequest("/auth/password-reset/request", { method: "POST", body: JSON.stringify(body) });
    return NextResponse.json({ accepted: true });
  } catch (error) {
    const status = error instanceof EncoreRequestError && error.status === 400 ? 400 : 503;
    return NextResponse.json({ error: status === 400 ? "Enter a valid email address." : "Password recovery is temporarily unavailable." }, { status });
  }
}
