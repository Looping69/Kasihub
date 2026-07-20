// Author: Klaasvaakie ( |╲ )
import { NextResponse } from "next/server";
import { EncoreRequestError, encoreRequest } from "@/lib/encore-client";

export async function GET() {
  try {
    const health = await encoreRequest<{ ok: boolean; service: string; hardeningRevision: string }>("/health");
    return NextResponse.json(health, { status: health.ok ? 200 : 503 });
  } catch (error) {
    const status = error instanceof EncoreRequestError ? error.status : 503;
    return NextResponse.json({ ok: false, service: "kasihub-backend", error: "Backend unavailable" }, { status });
  }
}
