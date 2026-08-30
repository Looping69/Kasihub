import { NextResponse } from "next/server";
import { EncoreRequestError, encoreRequest } from "@/lib/encore-client";

export async function GET(_req: Request, { params }: { params: Promise<{ verificationId: string }> }) {
  try {
    const { verificationId } = await params;
    const result = await encoreRequest(`/shares/certificates/verify/${encodeURIComponent(verificationId)}`);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof EncoreRequestError ? error.status : 500;
    return NextResponse.json({ verified: false, error: status === 404 ? "Certificate not found" : "Unable to verify certificate" }, { status });
  }
}
