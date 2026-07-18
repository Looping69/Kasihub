// Author: Klaasvaakie ( |╲ )
import { NextRequest, NextResponse } from "next/server";
import { EncoreRequestError, encoreRequest, encoreSessionToken } from "@/lib/encore-client";

export async function GET() {
  const token = await encoreSessionToken();
  if (!token) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  try {
    const data = await encoreRequest<{ silos: { percentage: number }[] }>("/admin/mall", {}, token);
    return NextResponse.json({ silos: data.silos, total: data.silos.reduce((sum, silo) => sum + silo.percentage, 0) });
  } catch (error) {
    return failure(error);
  }
}

export async function PATCH(req: NextRequest) {
  const token = await encoreSessionToken();
  if (!token) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const body = await req.json();
  if (!Array.isArray(body.silos)) return NextResponse.json({ error: "silos array is required" }, { status: 400 });
  try {
    return NextResponse.json(await encoreRequest("/admin/mall/silos", { method: "PATCH", body: JSON.stringify({ silos: body.silos }) }, token));
  } catch (error) {
    return failure(error);
  }
}

function failure(error: unknown) {
  const status = error instanceof EncoreRequestError ? error.status : 500;
  return NextResponse.json({ error: "Encore silo operation failed" }, { status });
}
