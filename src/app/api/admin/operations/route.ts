// Author: Klaasvaakie ( |╲ )
import { NextRequest, NextResponse } from "next/server";
import { EncoreRequestError, encoreRequest, encoreSessionToken } from "@/lib/encore-client";

export async function GET(req: NextRequest) {
  const token = await encoreSessionToken();
  if (!token) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  try {
    return NextResponse.json(await encoreRequest(`/admin/operations?${req.nextUrl.searchParams}`, {}, token));
  } catch (error) { return failure(error); }
}

export async function POST(req: NextRequest) {
  const token = await encoreSessionToken();
  if (!token) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const body = await req.json() as { operationId?: string };
  if (!body.operationId) return NextResponse.json({ error: "operationId is required" }, { status: 400 });
  try {
    return NextResponse.json(await encoreRequest(`/admin/operations/${encodeURIComponent(body.operationId)}/retry`, { method: "POST" }, token));
  } catch (error) { return failure(error); }
}

function failure(error: unknown) {
  const status = error instanceof EncoreRequestError ? error.status : 500;
  return NextResponse.json({ error: "Encore operation request failed" }, { status });
}
