// Author: Klaasvaakie ( |╲ )
import { NextRequest, NextResponse } from "next/server";
import { EncoreRequestError, encoreRequest, encoreSessionToken } from "@/lib/encore-client";

export async function POST(req: NextRequest) {
  const token = await encoreSessionToken();
  if (!token) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const { memberId, phone } = await req.json();
  if (!memberId || !phone) return NextResponse.json({ error: "Member and WhatsApp number are required" }, { status: 400 });
  try {
    return NextResponse.json(await encoreRequest(
      `/whatsapp/${encodeURIComponent(memberId)}/verification/request`,
      { method: "POST", body: JSON.stringify({ phone }) },
      token,
    ));
  } catch (error) {
    const status = error instanceof EncoreRequestError ? error.status : 500;
    const details = error instanceof EncoreRequestError && typeof error.details === "object" && error.details
      ? error.details as { message?: string }
      : null;
    return NextResponse.json({ error: details?.message ?? "Unable to send the verification code" }, { status });
  }
}
