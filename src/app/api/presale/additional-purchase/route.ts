// Author: Klaasvaakie ( |╲ )
import { NextResponse } from "next/server";
import { EncoreRequestError, encoreRequest, presaleSessionToken } from "@/lib/encore-client";

export async function POST() {
  const token = await presaleSessionToken();
  if (!token) return NextResponse.json({ error: "KaSiShares login is required" }, { status: 401 });
  try {
    return NextResponse.json(await encoreRequest(
      "/presale/applicant/additional-purchase",
      { method: "POST" },
      token,
    ));
  } catch (error) {
    const status = error instanceof EncoreRequestError ? error.status : 500;
    const message = status === 403
      ? "Your access to this campaign is no longer active."
      : status === 409 || status === 412
        ? error instanceof Error ? error.message : "Another purchase cannot be started right now."
        : "Another share purchase could not be started. Please try again.";
    return NextResponse.json({ error: message }, { status });
  }
}
