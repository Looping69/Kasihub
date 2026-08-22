// Author: Klaasvaakie ( |╲ )
import { NextResponse } from "next/server";
import { EncoreRequestError, encoreRequest, encoreSessionToken } from "@/lib/encore-client";
import type { Member } from "@/lib/types";

export async function POST() {
  const token = await encoreSessionToken();
  if (!token) return NextResponse.json({ error: "Sign in to start identity verification" }, { status: 401 });
  try {
    const profile = await encoreRequest<{ member: Member }>("/profiles/me", {}, token);
    const kycCase = await encoreRequest<{ id: string }>("/kyc/international/cases", {
      method: "POST",
      body: JSON.stringify({ profileId: profile.member.id }),
    }, token);
    const session = await encoreRequest<{ sessionId: string; url: string; status: string }>(
      `/kyc/international/cases/${encodeURIComponent(kycCase.id)}/didit-session`,
      { method: "POST" }, token,
    );
    return NextResponse.json({ session });
  } catch (error) {
    const status = error instanceof EncoreRequestError ? error.status : 500;
    const details = error instanceof EncoreRequestError && typeof error.details === "object" && error.details
      ? error.details as { message?: unknown }
      : null;
    const providerMessage = typeof details?.message === "string" && details.message.length <= 160
      ? details.message
      : null;
    return NextResponse.json({ error: providerMessage ?? "Identity verification could not be started" }, { status });
  }
}
