import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST /api/vouchers/wablast-active
// Pushes all active vouchers to WABlast to send directly to the client via WhatsApp.
// In production, this calls the WABlast API. Here we simulate the push and mark vouchers as sent.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { memberId } = body;

    if (!memberId) {
      return NextResponse.json({ error: "memberId is required" }, { status: 400 });
    }

    const member = await db.member.findUnique({ where: { id: memberId } });
    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // Get all active vouchers not yet pushed to WABlast
    const now = new Date();
    const vouchersToPush = await db.voucher.findMany({
      where: {
        memberId,
        status: "ACTIVE",
        wablastSent: false,
        expiryDate: { gt: now },
      },
    });

    if (vouchersToPush.length === 0) {
      return NextResponse.json({
        pushed: 0,
        message: "No new active vouchers to push. All active vouchers have already been sent.",
      });
    }

    // Simulate WABlast API call
    // In production: await fetch("https://api.wablast.com/send", { ... })
    const wablastPayload = {
      recipient: member.mobile,
      recipientName: `${member.firstName} ${member.lastName}`,
      message: `Hello ${member.firstName}, you have ${vouchersToPush.length} active voucher(s) on your KaSiHUB account:\n\n` +
        vouchersToPush.map((v, i) =>
          `${i + 1}. ${v.title} (${v.code})\n   Value: R${v.value}\n   Expires: ${new Date(v.expiryDate).toLocaleDateString("en-ZA")}\n   Provider: ${v.provider}`
        ).join("\n\n"),
      channel: "WHATSAPP",
      sentAt: new Date().toISOString(),
    };

    // Mark vouchers as pushed
    await db.voucher.updateMany({
      where: { id: { in: vouchersToPush.map((v) => v.id) } },
      data: { wablastSent: true },
    });

    return NextResponse.json({
      pushed: vouchersToPush.length,
      wablastPayload,
      vouchers: vouchersToPush.map((v) => ({
        code: v.code,
        title: v.title,
        value: v.value,
        expiryDate: v.expiryDate.toISOString(),
      })),
      message: `Successfully pushed ${vouchersToPush.length} active voucher(s) to WABlast for WhatsApp delivery to ${member.mobile}.`,
    });
  } catch (error) {
    console.error("[vouchers/wablast-active] error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
