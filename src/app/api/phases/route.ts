// Author: Klaasvaakie ( |╲ )
import { NextResponse } from "next/server";
import { EncoreRequestError, encoreRequest, encoreSessionToken } from "@/lib/encore-client";
import { mapSharePhase, type EncoreSharePhase } from "@/lib/shares-portfolio";

export async function GET() {
  const token = await encoreSessionToken();
  if (!token) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  try {
    const { phases } = await encoreRequest<{ phases: EncoreSharePhase[] }>("/shares/phases", {}, token);
    return NextResponse.json({ phases: phases.map(mapSharePhase) });
  } catch (error) {
    const status = error instanceof EncoreRequestError ? error.status : 500;
    return NextResponse.json({ error: "Unable to load phases from Encore" }, { status });
  }
}
