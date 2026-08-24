// Author: Klaasvaakie ( |╲ )
import { NextRequest, NextResponse } from "next/server";
import { presaleSessionToken, EncoreRequestError, encoreRequest } from "@/lib/encore-client";

function presaleFailureMessage(error: EncoreRequestError): string {
  // Surface only the backend's deliberately public validation message. Author: Klaasvaakie ( |╲ )
  if (error.status >= 400 && error.status < 500 && error.details && typeof error.details === "object") {
    const details = error.details as { error?: unknown; message?: unknown };
    const message = typeof details.error === "string" ? details.error : typeof details.message === "string" ? details.message : null;
    if (message && message.length <= 240) return message;
  }
  return "Unable to create the presale order";
}

export async function POST(req: NextRequest) {
  const idempotencyKey = req.headers.get("idempotency-key");
  if (!idempotencyKey) return NextResponse.json({ error: "Idempotency-Key is required" }, { status: 400 });
  // Reservations remain bound to the authenticated, KYC-verified profile. Author: Klaasvaakie ( |╲ )
  const token = await presaleSessionToken();
  if (!token) return NextResponse.json({ error: "Sign in to create a presale reservation" }, { status: 401 });
  try {
    const body = await req.json();
    return NextResponse.json(await encoreRequest("/presale/orders", {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify(body),
    }, token));
  } catch (error) {
    const status = error instanceof EncoreRequestError ? error.status : 500;
    return NextResponse.json({ error: error instanceof EncoreRequestError ? presaleFailureMessage(error) : "Unable to create the presale order" }, { status });
  }
}
