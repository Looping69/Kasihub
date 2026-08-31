// Author: Klaasvaakie ( |╲ )
import { NextRequest, NextResponse } from "next/server";
import { EncoreRequestError, encoreRequest, encoreSessionToken } from "@/lib/encore-client";
import {
  buildSharesData,
  type EncoreShareCertificate,
  type EncoreSharePhase,
} from "@/lib/shares-portfolio";

export async function GET(req: NextRequest) {
  const memberId = req.nextUrl.searchParams.get("memberId")?.trim();
  const token = await encoreSessionToken();
  if (!token) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!memberId) return NextResponse.json({ error: "A member profile is required" }, { status: 400 });
  try {
    const [phaseResponse, certificateResponse] = await Promise.all([
      encoreRequest<{ phases: EncoreSharePhase[] }>("/shares/phases", {}, token),
      encoreRequest<{ certificates: EncoreShareCertificate[] }>(
        `/shares/me/${encodeURIComponent(memberId)}`,
        {},
        token,
      ),
    ]);
    return NextResponse.json(
      buildSharesData(phaseResponse.phases, certificateResponse.certificates),
      { headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  } catch (error) {
    const status = error instanceof EncoreRequestError ? error.status : 500;
    return NextResponse.json(
      { error: status === 401 || status === 403 ? "Your member session cannot access this share portfolio" : "Unable to load the authoritative share portfolio" },
      { status, headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  }
}
