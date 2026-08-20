// Author: Klaasvaakie ( |╲ )
import { NextResponse } from "next/server";
import { EncoreRequestError, encoreRequest, encoreSessionToken } from "@/lib/encore-client";
import type { Member } from "@/lib/types";

type Verification = {
  required: boolean;
  verified: boolean;
  status: string;
  caseId: string | null;
};

export async function GET() {
  const token = await encoreSessionToken();
  if (!token) return NextResponse.json({ error: "Sign in to check identity verification" }, { status: 401 });

  try {
    const profile = await encoreRequest<{ member: Member }>("/profiles/me", {}, token);
    const verification = await encoreRequest<Verification>(
      `/kyc/international/status/${encodeURIComponent(profile.member.id)}`,
      {},
      token,
    );
    return NextResponse.json({ verification });
  } catch (error) {
    const status = error instanceof EncoreRequestError ? error.status : 500;
    return NextResponse.json({ error: "Identity verification status is unavailable" }, { status });
  }
}
