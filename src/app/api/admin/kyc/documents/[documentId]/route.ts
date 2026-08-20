// Author: Klaasvaakie ( |╲ )
import { NextResponse } from "next/server";
import { encoreSessionToken } from "@/lib/encore-client";

export async function GET(_req: Request, { params }: { params: Promise<{ documentId: string }> }) {
  const token = await encoreSessionToken();
  if (!token) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const baseUrl = process.env.ENCORE_API_URL?.replace(/\/$/, "");
  if (!baseUrl) return NextResponse.json({ error: "Encore API is not configured" }, { status: 503 });
  const { documentId } = await params;
  try {
    const upstream = await fetch(`${baseUrl}/admin/kyc/international/documents/${encodeURIComponent(documentId)}/file`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/pdf,image/jpeg,image/png" },
      cache: "no-store",
    });
    if (!upstream.ok || !upstream.body) {
      return NextResponse.json({ error: "Unable to open KYC evidence" }, { status: upstream.status });
    }
    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": upstream.headers.get("content-type") ?? "application/octet-stream",
        "Content-Disposition": "inline",
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "Unable to open KYC evidence" }, { status: 502 });
  }
}
