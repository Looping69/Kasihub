// Author: Klaasvaakie ( |╲ )
import { NextRequest, NextResponse } from "next/server";
import { EncoreRequestError, encoreRequest, encoreSessionToken } from "@/lib/encore-client";

export async function POST(_request: NextRequest, context: { params: Promise<{ batchId: string }> }) {
  const token = await encoreSessionToken();
  if (!token) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const { batchId } = await context.params;
  try {
    return NextResponse.json(await encoreRequest(`/admin/presale/incorporation-batches/${encodeURIComponent(batchId)}/apply`, { method: "POST" }, token));
  } catch (error) {
    const status = error instanceof EncoreRequestError ? error.status : 500;
    return NextResponse.json({ error: "Unable to apply the incorporation batch" }, { status });
  }
}
