// Author: Klaasvaakie ( |╲ )
import { NextResponse } from "next/server";
import { EncoreRequestError, encoreRequest, encoreSessionToken } from "@/lib/encore-client";
import { generateShareCertificatePdf } from "../../../../../lib/share-certificate-pdf";
import type { Member } from "@/lib/types";

export const runtime = "nodejs";

type Certificate = {
  certificateNumber: string;
  totalShares: number;
  status: string;
  issuedAt: string;
  revokedAt: string | null;
  distinctiveFrom?: number;
  distinctiveTo?: number;
  paidShares?: number;
  bonusShares?: number;
  issuePricePerShare?: number;
  issuePriceCurrency?: string;
};

export async function GET(_req: Request, { params }: { params: Promise<{ certificateNumber: string }> }) {
  const token = await encoreSessionToken();
  if (!token) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  try {
    const { certificateNumber } = await params;
    const profile = await encoreRequest<{ member: Member }>("/profiles/me", {}, token);
    const member = profile.member;
    const result = await encoreRequest<{ certificates: Certificate[] }>(
      `/shares/me/${encodeURIComponent(member.id)}`,
      {},
      token,
    );
    const certificate = result.certificates.find((item) => item.certificateNumber === certificateNumber);
    if (!certificate) return NextResponse.json({ error: "Certificate not found" }, { status: 404 });

    const holderName = member.companyName
      || [member.firstName, member.lastName].filter(Boolean).join(" ")
      || member.profileNumber;
    const pdf = await generateShareCertificatePdf({
      certificateNumber: certificate.certificateNumber,
      holderName,
      holderAddress: [member.addressLine, member.city, member.postalCode, member.country].filter(Boolean).join(", "),
      profileNumber: member.profileNumber,
      totalShares: certificate.totalShares,
      issuedAt: certificate.issuedAt,
      status: certificate.status,
      distinctiveFrom: certificate.distinctiveFrom,
      distinctiveTo: certificate.distinctiveTo,
      paidShares: certificate.paidShares,
      bonusShares: certificate.bonusShares,
      issuePricePerShare: certificate.issuePricePerShare,
      issuePriceCurrency: certificate.issuePriceCurrency,
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
