// Author: Klaasvaakie ( |╲ )
import { NextRequest, NextResponse } from "next/server";
import { EncoreRequestError, encoreRequest } from "@/lib/encore-client";

export async function GET(req: NextRequest, context: { params: Promise<{ reference: string }> }) {
  const { reference } = await context.params;
  const accessToken = req.nextUrl.searchParams.get("accessToken")?.trim();
  if (!accessToken) return NextResponse.json({ error: "Order access token is required" }, { status: 401 });
  try {
    return NextResponse.json(await encoreRequest(
      `/presale/orders/${encodeURIComponent(reference)}?accessToken=${encodeURIComponent(accessToken)}`,
    ));
  } catch (error) {
    const status = error instanceof EncoreRequestError ? error.status : 500;
    return NextResponse.json({ error: "Unable to load the presale order" }, { status });
  }
}
