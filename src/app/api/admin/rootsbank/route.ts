// Author: Klaasvaakie ( |╲ )
import { NextResponse } from "next/server";
import { EncoreRequestError, encoreRequest, encoreSessionToken } from "@/lib/encore-client";

type Pioneer = { category: string; totalAmount: number } & Record<string, unknown>;

export async function GET() {
  const token = await encoreSessionToken();
  if (!token) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  try {
    const { pioneers } = await encoreRequest<{ pioneers: Pioneer[] }>("/admin/rootsbank", {}, token);
    return NextResponse.json({
      pioneers: pioneers.map((pioneer) => ({ ...pioneer, member: { profileNumber: "Encore", name: "Encore member", email: "", country: "" } })),
      categoryBreakdown: {
        KIDS_STUDENT: pioneers.filter((pioneer) => pioneer.category === "KIDS_STUDENT").length,
        ADULT: pioneers.filter((pioneer) => pioneer.category === "ADULT").length,
        PENSIONER: pioneers.filter((pioneer) => pioneer.category === "PENSIONER").length,
      },
      totalCollected: pioneers.reduce((sum, pioneer) => sum + pioneer.totalAmount, 0),
      pioneerTarget: 200,
      remaining: Math.max(0, 200 - pioneers.length),
      pioneerPayouts: [],
    });
  } catch (error) {
    const status = error instanceof EncoreRequestError ? error.status : 500;
    return NextResponse.json({ error: "Unable to load Encore RootsBank administration" }, { status });
  }
}
