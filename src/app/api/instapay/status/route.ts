import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

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
