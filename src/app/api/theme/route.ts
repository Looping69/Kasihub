// Author: Klaasvaakie ( |╲ )
import { NextResponse } from "next/server";
import { EncoreRequestError, encoreRequest } from "@/lib/encore-client";

export async function GET() {
  try { return NextResponse.json(await encoreRequest("/theme")); }
  catch (error) {
    const status = error instanceof EncoreRequestError ? error.status : 503;
    return NextResponse.json({ error: "Theme service unavailable" }, { status });
  }
}
