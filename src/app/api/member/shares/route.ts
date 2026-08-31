// Author: Klaasvaakie ( |╲ )
import { NextResponse } from "next/server";
import { EncoreRequestError, encoreRequest, encoreSessionToken } from "@/lib/encore-client";
import {
  buildSharesDataFromPortfolio,
  type EncoreSharePhase,
  type ShareholderPortfolioV2,
} from "@/lib/shares-portfolio";

export async function GET() {
  const token = await encoreSessionToken();
  if (!token) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  try {
    const [portfolio, optionalPhases] = await Promise.all([
      encoreRequest<ShareholderPortfolioV2>("/shares/portfolio/me", {}, token),
      encoreRequest<{ phases: EncoreSharePhase[] }>("/shares/phases", {}, token)
        .then((result) => result.phases)
        .catch(() => [] as EncoreSharePhase[]),
    ]);
    return NextResponse.json(buildSharesDataFromPortfolio(portfolio, optionalPhases), {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    const status = error instanceof EncoreRequestError ? error.status : 500;
    return NextResponse.json({
      error: status === 401 || status === 403
        ? "Your member session cannot access this share portfolio"
        : "Unable to load the authoritative share portfolio",
    }, { status, headers: { "Cache-Control": "private, no-store, max-age=0" } });
  }
}
