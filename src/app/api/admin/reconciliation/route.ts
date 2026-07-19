// Author: Klaasvaakie ( |╲ )
import { NextRequest, NextResponse } from "next/server";
import { EncoreRequestError, encoreRequest, encoreSessionToken } from "@/lib/encore-client";

export async function GET(req: NextRequest) {
  const token = await encoreSessionToken();
  if (!token) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  try {
    return NextResponse.json(await encoreRequest(`/admin/reconciliation/findings?${req.nextUrl.searchParams}`, {}, token));
  } catch (error) { return failure(error); }
}

export async function POST(req: NextRequest) {
  const token = await encoreSessionToken();
  if (!token) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const body = await req.json().catch(() => ({})) as { findingId?: string; resolution?: string; state?: "resolved" | "ignored" };
  try {
    if (body.findingId) {
      return NextResponse.json(await encoreRequest(`/admin/reconciliation/findings/${encodeURIComponent(body.findingId)}/resolve`, {
        method: "POST", body: JSON.stringify({ resolution: body.resolution, state: body.state }),
      }, token));
    }
    return NextResponse.json(await encoreRequest("/admin/reconciliation/runs", { method: "POST" }, token));
  } catch (error) { return failure(error); }
}

function failure(error: unknown) {
  const status = error instanceof EncoreRequestError ? error.status : 500;
  return NextResponse.json({ error: "Encore reconciliation request failed" }, { status });
}
