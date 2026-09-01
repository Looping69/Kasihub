// Author: Klaasvaakie ( |╲ )
import { NextRequest, NextResponse } from "next/server";
import { EncoreRequestError, encoreRequest, encoreSessionToken } from "@/lib/encore-client";

function overrideFailureMessage(error: EncoreRequestError): string {
  if (!error.details || typeof error.details !== "object") return "Unable to allow share issuance";
  const details = error.details as { error?: unknown; message?: unknown };
  const message = typeof details.message === "string"
    ? details.message
    : typeof details.error === "string"
      ? details.error
      : null;
  return message && message.length <= 240 ? message : "Unable to allow share issuance";
}

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ orderReference: string }> },
) {
  const token = await encoreSessionToken();
  if (!token) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const { orderReference } = await context.params;
  try {
    return NextResponse.json(await encoreRequest(
      `/admin/presale/orders/${encodeURIComponent(orderReference)}/allow-allocation`,
      { method: "POST", body: "{}" },
      token,
    ));
  } catch (error) {
    const status = error instanceof EncoreRequestError ? error.status : 500;
    return NextResponse.json({
      error: error instanceof EncoreRequestError ? overrideFailureMessage(error) : "Unable to allow share issuance",
    }, { status });
  }
}
