// Author: Klaasvaakie ( |╲ )
import { NextRequest, NextResponse } from "next/server";
import { EncoreRequestError, encoreRequest } from "@/lib/encore-client";

export async function GET(req: NextRequest, context: { params: Promise<{ reference: string }> }) {
  const { reference } = await context.params;
  // The access token is a bearer credential. Never place it in a query string.
  // Author: Klaasvaakie ( |╲ )
  const accessToken = req.headers.get("x-presale-access-token")?.trim();
  if (!accessToken) return NextResponse.json({ error: "Order access token is required" }, { status: 401 });
  try {
    return NextResponse.json(await encoreRequest(
      `/presale/orders/${encodeURIComponent(reference)}`,
      { headers: { "X-Presale-Access-Token": accessToken } },
    ));
  } catch (error) {
    const status = error instanceof EncoreRequestError ? error.status : 500;
    return NextResponse.json({ error: "Unable to load the presale order" }, { status });
  }
}
