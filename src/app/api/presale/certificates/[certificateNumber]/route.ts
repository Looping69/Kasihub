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

function legacyAllocation(totalShares: number, paidShares: number) {
  if (!Number.isInteger(totalShares) || !Number.isInteger(paidShares) || paidShares <= 0 || paidShares > totalShares) {
    return {};
  }
  return { paidShares, bonusShares: totalShares - paidShares };
}

export async function GET(_req: Request, { params }: { params: Promise<{ certificateNumber: string }> }) {
  const token = await presaleSessionToken();
  if (!token) return NextResponse.json({ error: "KaSiShares login is required" }, { status: 401 });
  let requestedCertificateNumber = "unknown";
  try {
    const { certificateNumber } = await params;
    requestedCertificateNumber = certificateNumber;
    const portal = await encoreRequest<Portal>("/presale/applicant/portal", {}, token);
    const holding = portal.shareholder.holdings.find((item) => item.certificate?.certificateNumber === certificateNumber);
    if (!holding?.certificate) return NextResponse.json({ error: "Certificate not found" }, { status: 404 });
    const certificate = holding.certificate;
    const sealed = sealedCertificatePdfData({
      ...certificate,
      issuePricePerShare: certificate.issuePricePerShareSnapshot,
      issuePriceCurrency: certificate.issuePriceCurrencySnapshot,
    });
    const allocation = certificate.paidShares !== undefined && certificate.bonusShares !== undefined
      ? { paidShares: certificate.paidShares, bonusShares: certificate.bonusShares }
      : legacyAllocation(certificate.totalShares, holding.paidShares);
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
      ...allocation,
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
    console.error("presale_share_certificate_generation_failed", {
      certificateNumber: requestedCertificateNumber,
      error: error instanceof Error ? error.message : "unknown_error",
    });
    const status = error instanceof EncoreRequestError ? error.status : 500;
    return NextResponse.json({ error: "Unable to generate share certificate" }, { status });
  }
}
