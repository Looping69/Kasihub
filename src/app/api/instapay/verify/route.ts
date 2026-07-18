// Author: Klaasvaakie ( |╲ )
import { NextRequest, NextResponse } from "next/server";
import { EncoreRequestError, encoreRequest, encoreSessionToken } from "@/lib/encore-client";

export async function POST(req: NextRequest) {
  const token = await encoreSessionToken();
  if (!token) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const body = await req.json();
  if (!body.memberId) return NextResponse.json({ error: "memberId is required" }, { status: 400 });
  try {
    const kycCase = await encoreRequest<{ id: string; status: string }>(
      "/kyc/cases",
      { method: "POST", body: JSON.stringify({ profileId: body.memberId, provider: "instapay" }) },
      token,
    );
    return NextResponse.json({ verified: false, status: kycCase.status.toUpperCase(), caseId: kycCase.id, message: "Verification was submitted and is awaiting provider confirmation." }, { status: 202 });
  } catch (error) {
    const status = error instanceof EncoreRequestError ? error.status : 500;
    return NextResponse.json({ error: "Encore verification submission failed" }, { status });
  }
}

export { GET } from "../status/route";
