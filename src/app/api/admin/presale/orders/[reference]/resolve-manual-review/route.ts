// Author: Klaasvaakie ( |╲ )
import { NextRequest, NextResponse } from "next/server";
import { EncoreRequestError, encoreRequest, encoreSessionToken } from "@/lib/encore-client";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ reference: string }> },
) {
  const token = await encoreSessionToken();
  if (!token) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const { reference } = await params;
  try {
    const body = await req.json();
    const result = await encoreRequest(
      `/admin/presale/orders/${encodeURIComponent(reference)}/resolve-manual-review`,
      {
        method: "POST",
        body: JSON.stringify(body),
      },
      token,
    );
    return NextResponse.json(result);
  } catch (error) {
    const status = error instanceof EncoreRequestError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Unable to resolve manual review";
    return NextResponse.json({ error: message }, { status });
  }
}
