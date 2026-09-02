// Author: Klaasvaakie ( |╲ )
import { NextRequest, NextResponse } from "next/server";
import { EncoreRequestError, encoreRequest, presaleSessionToken } from "@/lib/encore-client";

export async function GET(req: NextRequest, context: { params: Promise<{ reference: string }> }) {
  const { reference } = await context.params;
  const authHeader = req.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : authHeader?.trim();
  const token = bearerToken
    || req.headers.get("x-presale-session-token")?.trim()
    || req.cookies.get("kasishares_session")?.value
    || req.cookies.get("kasihub_session")?.value
    || await presaleSessionToken();
  if (!token) return NextResponse.json({ error: "KaSiShares login is required" }, { status: 401 });
  try {
    return NextResponse.json(await encoreRequest(
      `/presale/orders/${encodeURIComponent(reference)}`,
      {},
      token,
    ));
  } catch (error) {
    const status = error instanceof EncoreRequestError ? error.status : 500;
    return NextResponse.json({ error: "Unable to load the presale order" }, { status });
  }
}
