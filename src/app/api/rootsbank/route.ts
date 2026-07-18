// Author: Klaasvaakie ( |╲ )
import { NextRequest, NextResponse } from "next/server";
import { EncoreRequestError, encoreRequest, encoreSessionToken } from "@/lib/encore-client";

const categories = [
  { key: "KIDS_STUDENT", label: "Kids & Students (16-18)", sharePrice: 500, membershipFee: 50, total: 550, description: "Ages 16-18 and students who can prove they are studying.", documents: ["Proof of studies"] },
  { key: "ADULT", label: "Adults (18-65)", sharePrice: 500, membershipFee: 200, total: 700, description: "Adults purchase one pioneer share and bank membership.", documents: ["South African ID or Passport"] },
  { key: "PENSIONER", label: "Pensioners", sharePrice: 500, membershipFee: 50, total: 550, description: "Pensioner pioneer membership.", documents: ["South African ID", "SASSA proof where applicable"] },
];

export async function GET(req: NextRequest) {
  const memberId = req.nextUrl.searchParams.get("memberId");
  const token = await encoreSessionToken();
  if (!memberId) return NextResponse.json({ error: "memberId is required" }, { status: 400 });
  if (!token) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  try {
    const data = await encoreRequest<{ pioneerCount: number; myShare: unknown }>(`/rootsbank/${encodeURIComponent(memberId)}`, {}, token);
    return NextResponse.json({
      bankDetails: { bankName: "Solidus Holdings (Pty) Ltd", bank: "FNB", accountType: "Gold Business Account", accountNumber: "63212306319", branchCode: "210835", reference: `KSH-${memberId.slice(-6).toUpperCase()}` },
      pioneerCount: data.pioneerCount,
      pioneerTarget: 200,
      pioneerProgress: Number(((data.pioneerCount / 200) * 100).toFixed(1)),
      categories,
      myShare: data.myShare,
    });
  } catch (error) {
    const status = error instanceof EncoreRequestError ? error.status : 500;
    return NextResponse.json({ error: "Unable to load RootsBank from Encore" }, { status });
  }
}
