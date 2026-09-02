// Author: Klaasvaakie ( |╲ )
import { NextRequest, NextResponse } from "next/server";
import { EncoreRequestError, encoreRequest, encoreSessionToken } from "@/lib/encore-client";

function invitationFailureMessage(error: EncoreRequestError): string {
  if (error.status < 400 || error.status >= 500 || !error.details || typeof error.details !== "object") {
    return "Unable to create the private invitation";
  }
  const details = error.details as { error?: unknown; message?: unknown };
  const message = typeof details.error === "string"
    ? details.error
    : typeof details.message === "string"
      ? details.message
      : null;
  return message && message.length <= 240
    ? message
    : "Unable to create the private invitation";
}

export async function POST(req: NextRequest) {
  const token = await encoreSessionToken();
  if (!token) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  try {
    const body = await req.json().catch(() => ({}));
    return NextResponse.json(await encoreRequest("/admin/presale/invitations", { method: "POST", body: JSON.stringify(body) }, token));
  } catch (error) {
    const status = error instanceof EncoreRequestError ? error.status : 500;
    return NextResponse.json({
      error: error instanceof EncoreRequestError
        ? invitationFailureMessage(error)
        : "Unable to create the private invitation",
    }, { status });
  }
}

