// Author: Klaasvaakie ( |╲ )
import { NextResponse } from "next/server";
import { EncoreRequestError, encoreRequest, encoreSessionToken } from "@/lib/encore-client";

type Phase = { id: string; phaseNumber: number; quantityAvailable: number; pricePerShare: string; status: string };

export async function GET() {
  const token = await encoreSessionToken();
  if (!token) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  try {
    const { phases } = await encoreRequest<{ phases: Phase[] }>("/shares/phases", {}, token);
    return NextResponse.json({ phases: phases.map((phase) => ({ id: phase.id, phase: phase.phaseNumber, pricePerShare: Number(phase.pricePerShare), totalShares: phase.quantityAvailable, soldShares: 0, status: phase.status === "active" ? "OPEN" : phase.status.toUpperCase(), bonusBuyOneGet: phase.phaseNumber === 1 })) });
  } catch (error) {
    const status = error instanceof EncoreRequestError ? error.status : 500;
    return NextResponse.json({ error: "Unable to load phases from Encore" }, { status });
  }
}
