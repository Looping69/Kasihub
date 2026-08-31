// Author: Klaasvaakie ( |╲ )
import { NextRequest, NextResponse } from "next/server";
import { EncoreRequestError, encoreRequest, encoreSessionToken } from "@/lib/encore-client";

function campaignFailureMessage(error: EncoreRequestError): string {
  if (error.status < 400 || error.status >= 500 || !error.details || typeof error.details !== "object") {
    return "Unable to configure the presale campaign";
  }
  const details = error.details as { error?: unknown; message?: unknown };
  const message = typeof details.error === "string"
    ? details.error
    : typeof details.message === "string"
      ? details.message
      : null;
  return message && message.length <= 240
    ? message
    : "Unable to configure the presale campaign";
}

export async function POST(req: NextRequest) {
  const token = await encoreSessionToken();
  if (!token) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  try {
    return NextResponse.json(await encoreRequest("/admin/presale/campaigns", { method: "POST", body: JSON.stringify(await req.json()) }, token));
  } catch (error) {
    const status = error instanceof EncoreRequestError ? error.status : 500;
    return NextResponse.json({
      error: error instanceof EncoreRequestError
        ? campaignFailureMessage(error)
        : "Unable to configure the presale campaign",
    }, { status });
  }
}

export async function GET() {
  const token = await encoreSessionToken();
  if (!token) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  try {
    return NextResponse.json(await encoreRequest("/admin/presale/campaigns", {}, token));
  } catch (error) {
    const status = error instanceof EncoreRequestError ? error.status : 500;
    return NextResponse.json({ error: "Unable to load presale campaigns" }, { status });
  }
}
