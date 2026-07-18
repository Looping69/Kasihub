// Author: Klaasvaakie ( |╲ )
import { NextRequest, NextResponse } from "next/server";
import { EncoreRequestError, encoreRequest, encoreSessionToken } from "@/lib/encore-client";

export async function PATCH(req: NextRequest) {
  const token = await encoreSessionToken();
  if (!token) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const body = await req.json();
  if (!body.memberId || !["APPROVE", "REJECT"].includes(body.action)) {
    return NextResponse.json({ error: "memberId and action are required" }, { status: 400 });
  }
  try {
    const result = await encoreRequest<{ profileId: string; kycStatus: string }>(
      `/admin/kyc/profiles/${encodeURIComponent(body.memberId)}/review`,
      { method: "POST", body: JSON.stringify({ action: body.action }) },
      token,
    );
    return NextResponse.json({ member: { id: result.profileId, kycStatus: result.kycStatus }, kycStatus: result.kycStatus });
  } catch (error) {
    const status = error instanceof EncoreRequestError ? error.status : 500;
    return NextResponse.json({ error: "Encore KYC review failed" }, { status });
  }
}
