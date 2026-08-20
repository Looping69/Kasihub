// Author: Klaasvaakie ( |╲ )
import { NextRequest, NextResponse } from "next/server";
import { EncoreRequestError, encoreRequest, encoreSessionToken } from "@/lib/encore-client";

function status(error: unknown) {
  return error instanceof EncoreRequestError ? error.status : 500;
}

export async function GET(req: NextRequest) {
  const token = await encoreSessionToken();
  if (!token) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const memberId = req.nextUrl.searchParams.get("memberId")?.trim();
  if (!memberId) return NextResponse.json({ error: "memberId is required" }, { status: 400 });
  try {
    return NextResponse.json(await encoreRequest(
      `/admin/kyc/international/profiles/${encodeURIComponent(memberId)}/documents`,
      {},
      token,
    ));
  } catch (error) {
    return NextResponse.json({ error: "Unable to load KYC evidence" }, { status: status(error) });
  }
}

export async function PATCH(req: NextRequest) {
  const token = await encoreSessionToken();
  if (!token) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const body = await req.json();
  if (!body.documentId || !["APPROVE", "REJECT"].includes(body.action)) {
    return NextResponse.json({ error: "documentId and action are required" }, { status: 400 });
  }
  if (body.action === "REJECT" && !body.reason?.trim()) {
    return NextResponse.json({ error: "A rejection reason is required" }, { status: 400 });
  }
  try {
    return NextResponse.json(await encoreRequest(
      `/admin/kyc/international/documents/${encodeURIComponent(body.documentId)}/review`,
      { method: "POST", body: JSON.stringify({ action: body.action, reason: body.reason }) },
      token,
    ));
  } catch (error) {
    return NextResponse.json({ error: "Unable to review KYC evidence" }, { status: status(error) });
  }
}
