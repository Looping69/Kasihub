import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST /api/instapay/verify - verify an InstaPay Gini account
// Accepts: idNumber, passportNumber, asylumNumber, companyRegNo, or npoNgoNumber
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { memberId, idNumber, passportNumber, asylumNumber, companyRegNo, npoNgoNumber } = body;

    if (!memberId) {
      return NextResponse.json({ error: "memberId is required" }, { status: 400 });
    }

    // At least one identifier must be provided
    const identifier = idNumber || passportNumber || asylumNumber || companyRegNo || npoNgoNumber;
    if (!identifier) {
      return NextResponse.json({ error: "At least one identifier is required" }, { status: 400 });
    }

    const member = await db.member.findUnique({ where: { id: memberId } });
    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // Simulate InstaPay Gini verification API call
    // In production, this would call the actual InstaPay verify API
    const verifyApiSetting = await db.setting.findUnique({ where: { key: "instapay_verify_api" } });
    const _apiUrl = verifyApiSetting?.value || "https://api.instapay-gini.co.za/verify";

    // Simulated verification — accepts any non-empty identifier
    // In production: const response = await fetch(apiUrl, { method: "POST", body: JSON.stringify({ idNumber, ... }) })
    const isVerified = identifier.length >= 6;

    if (isVerified) {
      const accountRef = `IPG-${identifier.slice(-6).toUpperCase()}-${Math.floor(Math.random() * 1000)}`;
      const updated = await db.member.update({
        where: { id: memberId },
        data: {
          instapayStatus: "VERIFIED",
          instapayVerifiedAt: new Date(),
          instapayAccountRef: accountRef,
        },
      });

      return NextResponse.json({
        verified: true,
        accountRef,
        member: {
          ...updated,
          createdAt: updated.createdAt.toISOString(),
          updatedAt: updated.updatedAt.toISOString(),
          kycVerifiedAt: updated.kycVerifiedAt?.toISOString() || null,
          instapayVerifiedAt: updated.instapayVerifiedAt?.toISOString() || null,
        },
      });
    } else {
      await db.member.update({
        where: { id: memberId },
        data: { instapayStatus: "PENDING" },
      });
      return NextResponse.json({
        verified: false,
        message: "InstaPay account not found. Please download the InstaPay Gini app and create an account first.",
      }, { status: 404 });
    }
  } catch (error) {
    console.error("[instapay/verify] error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// GET /api/instapay/status?memberId=xxx - check InstaPay status + get download links
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const memberId = searchParams.get("memberId");

    const androidSetting = await db.setting.findUnique({ where: { key: "instapay_android_url" } });
    const iosSetting = await db.setting.findUnique({ where: { key: "instapay_ios_url" } });

    let status = "NONE";
    let accountRef: string | null = null;
    if (memberId) {
      const member = await db.member.findUnique({ where: { id: memberId } });
      if (member) {
        status = member.instapayStatus;
        accountRef = member.instapayAccountRef;
      }
    }

    return NextResponse.json({
      status,
      accountRef,
      androidUrl: androidSetting?.value || "https://play.google.com/store/apps/instapay-gini",
      iosUrl: iosSetting?.value || "https://apps.apple.com/instapay-gini",
    });
  } catch (error) {
    console.error("[instapay/status] error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
