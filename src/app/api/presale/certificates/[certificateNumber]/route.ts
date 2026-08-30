// Author: Klaasvaakie ( |╲ )
import { NextResponse } from "next/server";
import { EncoreRequestError, encoreRequest, presaleSessionToken } from "@/lib/encore-client";
import { generateShareCertificatePdf } from "../../../../../lib/share-certificate-pdf";
import { sealedCertificatePdfData, type CertificateIntegrityFields } from "../../../../../lib/share-certificate-integrity";

export const runtime = "nodejs";

type Portal = {
  applicant: { profileNumber: string; legalName: string; physicalAddress: string };
  shareholder: {
    holdings: Array<{
      orderReference: string; campaignName: string; paidShares: number; bonusShares: number;
      issuePricePerShare?: number; issuePriceCurrency?: string;
      certificate?: CertificateIntegrityFields & { certificateNumber: string; totalShares: number; status: string; issuedAt: string;
        distinctiveFrom?: number; distinctiveTo?: number; paidShares?: number; bonusShares?: number;
        issuePricePerShareSnapshot?: number; issuePriceCurrencySnapshot?: string };
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
    const sealed = sealedCertificatePdfData({
      ...certificate,
      paidShares: certificate.paidShares ?? holding.paidShares,
      bonusShares: certificate.bonusShares ?? holding.bonusShares,
      issuePricePerShare: certificate.issuePricePerShareSnapshot ?? holding.issuePricePerShare,
      issuePriceCurrency: certificate.issuePriceCurrencySnapshot ?? holding.issuePriceCurrency,
    });
    const pdf = await generateShareCertificatePdf(sealed ? { ...sealed, campaignName: holding.campaignName } : {
      certificateNumber: certificate.certificateNumber,
      holderName: portal.applicant.legalName || portal.applicant.profileNumber,
      holderAddress: portal.applicant.physicalAddress,
      profileNumber: portal.applicant.profileNumber,
      orderReference: holding.orderReference,
      totalShares: certificate.totalShares,
      issuedAt: certificate.issuedAt,
      status: certificate.status,
      campaignName: holding.campaignName,
      paidShares: holding.paidShares,
      bonusShares: holding.bonusShares,
      distinctiveFrom: certificate.distinctiveFrom,
      distinctiveTo: certificate.distinctiveTo,
      issuePricePerShare: holding.issuePricePerShare,
      issuePriceCurrency: holding.issuePriceCurrency,
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
