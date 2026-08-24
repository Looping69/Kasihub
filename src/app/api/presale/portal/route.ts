// Author: Klaasvaakie ( |╲ )
import { NextResponse } from "next/server";
import { EncoreRequestError, encoreRequest, presaleSessionToken } from "@/lib/encore-client";

export async function GET() {
  const token = await presaleSessionToken();
  if (!token) return NextResponse.json({ error: "KaSiShares login is required" }, { status: 401 });
  try {
    const portal = await encoreRequest<Record<string, unknown>>("/presale/applicant/portal", {}, token);
    const testInviteUrl = authenticatedTestInviteUrl();
    return NextResponse.json(testInviteUrl ? { ...portal, testInviteUrl } : portal);
  } catch (error) {
    const status = error instanceof EncoreRequestError ? error.status : 500;
    return NextResponse.json({ error: status === 401 || status === 403 ? "KaSiShares login is required" : "Applicant status is temporarily unavailable" }, { status });
  }
}

function authenticatedTestInviteUrl(): string | undefined {
  const configured = process.env.KASISHARES_TEST_INVITE_URL?.trim();
  if (!configured) return undefined;
  try {
    const url = new URL(configured);
    const invite = url.searchParams.get("invite")?.trim();
    if (url.origin !== "https://shares.kasihub.net" || !invite || invite.length < 32) return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}
