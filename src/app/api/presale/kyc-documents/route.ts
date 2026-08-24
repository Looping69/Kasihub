// Author: Klaasvaakie ( |╲ )
import { NextRequest, NextResponse } from "next/server";
import { EncoreRequestError, encoreRequest, presaleSessionToken } from "@/lib/encore-client";
import type { Member } from "@/lib/types";

const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);
const DOCUMENT_TYPES = new Set(["identity_document", "identity_selfie"]);

function publicUploadError(error: unknown): { status: number; message: string } {
  if (!(error instanceof EncoreRequestError)) return { status: 500, message: "Identity evidence could not be uploaded" };
  const details = error.details as { error?: unknown; message?: unknown } | null;
  const upstreamMessage = typeof details?.error === "string"
    ? details.error
    : typeof details?.message === "string" ? details.message : "";
  return {
    status: error.status,
    message: upstreamMessage && upstreamMessage.length <= 240 ? upstreamMessage : "Identity evidence could not be uploaded",
  };
}

export async function POST(req: NextRequest) {
  const token = await presaleSessionToken();
  if (!token) return NextResponse.json({ error: "Sign in to upload identity evidence" }, { status: 401 });

  try {
    const data = await req.formData();
    const file = data.get("file");
    const documentType = String(data.get("documentType") ?? "");
    if (!(file instanceof File) || !DOCUMENT_TYPES.has(documentType)) {
      return NextResponse.json({ error: "A valid identity document type and file are required" }, { status: 400 });
    }
    if (!ALLOWED_TYPES.has(file.type) || (documentType === "identity_selfie" && file.type === "application/pdf")) {
      return NextResponse.json({ error: documentType === "identity_selfie" ? "The selfie must be a JPEG or PNG image" : "The ID document must be a PDF, JPEG, or PNG" }, { status: 400 });
    }
    if (file.size === 0 || file.size > MAX_DOCUMENT_BYTES) {
      return NextResponse.json({ error: "Each identity file must be between 1 byte and 10 MB" }, { status: 413 });
    }

    const profile = await encoreRequest<{ member: Member }>("/profiles/me", {}, token);
    const kycCase = await encoreRequest<{ id: string }>("/kyc/international/cases", {
      method: "POST",
      body: JSON.stringify({ profileId: profile.member.id }),
    }, token);
    const uploaded = await encoreRequest<{ id: string; status: string; duplicate: boolean }>(
      `/kyc/international/cases/${encodeURIComponent(kycCase.id)}/documents`,
      {
        method: "POST",
        headers: {
          "Content-Type": file.type,
          "X-Filename": file.name.slice(0, 255),
          "X-Document-Type": documentType,
        },
        body: await file.arrayBuffer(),
      },
      token,
    );
    return NextResponse.json({ document: uploaded }, { status: uploaded.duplicate ? 200 : 201 });
  } catch (error) {
    const failure = publicUploadError(error);
    return NextResponse.json({ error: failure.message }, { status: failure.status });
  }
}
