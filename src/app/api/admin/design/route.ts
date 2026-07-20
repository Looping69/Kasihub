// Author: Klaasvaakie ( |╲ )
import { NextRequest, NextResponse } from "next/server";
import { EncoreRequestError, encoreRequest, encoreSessionToken } from "@/lib/encore-client";

async function adminRequest(path: string, init: RequestInit = {}) {
  const token = await encoreSessionToken();
  if (!token) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  try { return NextResponse.json(await encoreRequest(path, init, token)); }
  catch (error) {
    const status = error instanceof EncoreRequestError ? error.status : 500;
    return NextResponse.json({ error: "Design suite request failed" }, { status });
  }
}

export async function GET() { return adminRequest("/admin/theme"); }
export async function POST(req: NextRequest) {
  return adminRequest("/admin/theme", { method: "POST", body: JSON.stringify(await req.json()) });
}
