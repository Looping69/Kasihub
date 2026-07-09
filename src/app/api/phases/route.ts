import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/phases - get all share phases
export async function GET() {
  try {
    const phases = await db.sharePhase.findMany({ orderBy: { phase: "asc" } });
    return NextResponse.json({ phases });
  } catch (error) {
    console.error("[phases] error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
