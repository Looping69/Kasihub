// Author: Klaasvaakie ( |╲ )
import { NextRequest, NextResponse } from "next/server";
import { EncoreRequestError, encoreRequest, encoreSessionToken } from "@/lib/encore-client";

type Phase = {
  id: string;
  phaseNumber: number;
  quantityAvailable: number;
  pricePerShare: string;
  currency: string;
  status: string;
};
type Certificate = {
  certificateNumber: string;
  totalShares: number;
  status: string;
  issuedAt: string;
  revokedAt: string | null;
};

export async function GET(req: NextRequest) {
  const memberId = req.nextUrl.searchParams.get("memberId");
  const token = await encoreSessionToken();
  if (!token) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  try {
    const phaseResponse = await encoreRequest<{ phases: Phase[] }>("/shares/phases", {}, token);
    const certificates = memberId
      ? (await encoreRequest<{ certificates: Certificate[] }>(`/shares/me/${encodeURIComponent(memberId)}`, {}, token)).certificates
      : [];
    const phaseMap = new Map(phaseResponse.phases.map((phase) => [phase.phaseNumber, phase]));
    const defaultPhase = phaseResponse.phases[0];
    const mapCertificate = (certificate: Certificate) => ({
      id: certificate.certificateNumber,
      phase: defaultPhase?.phaseNumber ?? 1,
      pricePerShare: Number(defaultPhase?.pricePerShare ?? 0),
      quantity: certificate.totalShares,
      totalAmount: certificate.totalShares * Number(defaultPhase?.pricePerShare ?? 0),
      certificateNo: certificate.certificateNumber,
      prevCertificateNo: null,
      status: certificate.status.toUpperCase(),
      createdAt: certificate.issuedAt,
      isLegacy: (defaultPhase?.phaseNumber ?? 1) === 1,
      currentValuePerShare: Number(defaultPhase?.pricePerShare ?? 0),
      currentTotalValue: certificate.totalShares * Number(defaultPhase?.pricePerShare ?? 0),
    });
    const activeShares = certificates.filter((certificate) => certificate.status !== "revoked").map(mapCertificate);
    const retractedShares = certificates.filter((certificate) => certificate.status === "revoked").map(mapCertificate);
    const totalShares = activeShares.reduce((sum, share) => sum + share.quantity, 0);
    const shareValuePerShare = Number(defaultPhase?.pricePerShare ?? 0);
    const phases = phaseResponse.phases.map((phase) => ({
      id: phase.id,
      phase: phase.phaseNumber,
      pricePerShare: Number(phase.pricePerShare),
      totalShares: phase.quantityAvailable,
      soldShares: 0,
      status: phase.status === "active" ? "OPEN" : phase.status.toUpperCase(),
      bonusBuyOneGet: phase.phaseNumber === 1,
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
    }));
    return NextResponse.json({
      phases,
      activeShares,
      retractedShares,
      aureusShares: [],
      retractedAureusShares: [],
      totalShares,
      totalValue: totalShares * shareValuePerShare,
      shareValuePerShare,
      legacyShares: activeShares.filter((share) => share.isLegacy).reduce((sum, share) => sum + share.quantity, 0),
      aureusValuePerShare: 0,
      aureusTotalShares: 0,
      aureusTotalValue: 0,
      dailyProfitSharePerShare: 0,
      myDailyProfitShare: 0,
      totalSharesOutstanding: Math.max(1, Array.from(phaseMap.values()).reduce((sum, phase) => sum + phase.quantityAvailable, 0)),
    });
  } catch (error) {
    const status = error instanceof EncoreRequestError ? error.status : 500;
    return NextResponse.json({ error: "Unable to load shares from Encore" }, { status });
  }
}
