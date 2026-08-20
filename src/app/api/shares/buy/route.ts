// Author: Klaasvaakie ( |╲ )
import { NextRequest, NextResponse } from "next/server";
import { encoreSessionToken } from "@/lib/encore-client";

export async function POST(_req: NextRequest) {
  const token = await encoreSessionToken();
  if (!token) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  return NextResponse.json(
    { error: "Direct share purchases are disabled; use the private presale application" },
    { status: 409 },
  );
}
