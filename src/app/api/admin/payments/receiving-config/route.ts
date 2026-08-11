// Author: Klaasvaakie ( |╲ )
import { NextRequest, NextResponse } from "next/server";
import { EncoreRequestError, encoreRequest, encoreSessionToken } from "@/lib/encore-client";

function failure(error: unknown) {
  const status = error instanceof EncoreRequestError ? error.status : 500;
  return NextResponse.json({ error: "Receiving configuration request failed" }, { status });
}

export async function GET() {
  const token = await encoreSessionToken();
  if (!token) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  try {
    return NextResponse.json(await encoreRequest("/admin/payments/receiving-config", {}, token));
  } catch (error) {
    return failure(error);
  }
}

export async function POST(req: NextRequest) {
  const token = await encoreSessionToken();
  if (!token) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  try {
    return NextResponse.json(await encoreRequest(
      "/admin/payments/receiving-config",
      { method: "POST", body: JSON.stringify(await req.json()) },
      token,
    ));
  } catch (error) {
    return failure(error);
  }
}
