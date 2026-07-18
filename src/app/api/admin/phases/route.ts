// Author: Klaasvaakie ( |╲ )
import { NextRequest, NextResponse } from "next/server";
import { EncoreRequestError, encoreRequest, encoreSessionToken } from "@/lib/encore-client";

export async function PATCH(req: NextRequest) {
  const token = await encoreSessionToken();
  if (!token) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const body = await req.json();
  if (!body.phaseId) return NextResponse.json({ error: "phaseId is required" }, { status: 400 });
  try {
    const data = await encoreRequest<{ phase: Record<string, unknown> }>(
      `/admin/shares/phases/${encodeURIComponent(body.phaseId)}`,
      { method: "PATCH", body: JSON.stringify(body) },
      token,
    );
    const phase = data.phase as { phaseNumber: number; quantityAvailable: number; totalShares?: number; pricePerShare: string; status: string };
    return NextResponse.json({ phase: { ...phase, phase: phase.phaseNumber, pricePerShare: Number(phase.pricePerShare), totalShares: phase.totalShares ?? phase.quantityAvailable, soldShares: (phase.totalShares ?? phase.quantityAvailable) - phase.quantityAvailable, status: phase.status === "active" ? "OPEN" : phase.status.toUpperCase() } });
  } catch (error) {
    const status = error instanceof EncoreRequestError ? error.status : 500;
    return NextResponse.json({ error: "Encore phase update failed" }, { status });
  }
}
