// Author: Klaasvaakie ( |╲ )
import { NextRequest, NextResponse } from "next/server";
import { EncoreRequestError, encoreRequest } from "@/lib/encore-client";

export async function GET(req: NextRequest) {
  const inviteToken = req.nextUrl.searchParams.get("invite")?.trim();
  if (!inviteToken) return NextResponse.json({ error: "A private invitation is required" }, { status: 403 });
  try {
    return NextResponse.json(await encoreRequest(`/presale/offer?inviteToken=${encodeURIComponent(inviteToken)}`));
  } catch (error) {
    const status = error instanceof EncoreRequestError ? error.status : 500;
    return NextResponse.json({ error: status === 403 ? "This invitation is invalid or unavailable" : "Unable to load the presale" }, { status });
  }
}
