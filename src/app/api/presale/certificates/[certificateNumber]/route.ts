// Author: Klaasvaakie ( |╲ )
import { NextResponse } from "next/server";
import { EncoreRequestError, encoreRequest, presaleSessionToken } from "@/lib/encore-client";
import { generateShareCertificatePdf } from "../../../../../lib/share-certificate-pdf";

export const runtime = "nodejs";

type Portal = {
  applicant: { profileNumber: string; legalName: string };
  shareholder: {
    holdings: Array<{
      campaignName: string; paidShares: number; bonusShares: number;
      certificate?: { certificateNumber: string; totalShares: number; status: string; issuedAt: string };
    }>;
  };
};

export async function GET(_req: Request, { params }: { params: Promise<{ certificateNumber: string }> }) {
  const token = await presaleSessionToken();
  if (!token) return NextResponse.json({ error: "KaSiShares login is required" }, { status: 401 });
  try {
    const { certificateNumber } = await params;
    const portal = await encoreRequest<Portal>("/presale/applicant/portal", {}, token);
    const holding = portal.shareholder.holdings.find((item) => item.certificate?.certificateNumber === certificateNumber);
    if (!holding?.certificate) return NextResponse.json({ error: "Certificate not found" }, { status: 404 });
    const certificate = holding.certificate;
    const pdf = await generateShareCertificatePdf({
      certificateNumber: certificate.certificateNumber,
      holderName: portal.applicant.legalName || portal.applicant.profileNumber,
      profileNumber: portal.applicant.profileNumber,
      totalShares: certificate.totalShares,
      issuedAt: certificate.issuedAt,
      status: certificate.status,
      campaignName: holding.campaignName,
      paidShares: holding.paidShares,
      bonusShares: holding.bonusShares,
    });
    const safeFilename = certificate.certificateNumber.replace(/[^A-Za-z0-9._-]/g, "_");
    return new NextResponse(Buffer.from(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeFilename}.pdf"`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const status = error instanceof EncoreRequestError ? error.status : 500;
    return NextResponse.json({ error: "Unable to generate share certificate" }, { status });
  }
}
