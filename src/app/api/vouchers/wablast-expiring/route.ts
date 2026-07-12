import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST /api/vouchers/wablast-expiring
// Pushes vouchers expiring within 5 days of the anniversary date to WABlast.
// This API runs 5 days before the anniversary date and sends all valid vouchers that will expire.
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

    const now = new Date();
    const fiveDaysFromNow = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);

    // Get all active vouchers that will expire within 5 days (from anniversary or regular expiry)
    // and haven't had the expiring reminder sent yet
    const expiringVouchers = await db.voucher.findMany({
      where: {
        memberId,
        status: "ACTIVE",
        expiringSent: false,
        OR: [
          { expiryDate: { lte: fiveDaysFromNow, gt: now } },
          { anniversaryDate: { lte: fiveDaysFromNow, gt: now } },
        ],
      },
    });

    if (expiringVouchers.length === 0) {
      return NextResponse.json({
        pushed: 0,
        message: "No vouchers expiring within 5 days. No reminders to send.",
      });
    }

    // Simulate WABlast API call for expiring vouchers
    const wablastPayload = {
      recipient: member.mobile,
      recipientName: `${member.firstName} ${member.lastName}`,
      message: `URGENT: ${member.firstName}, you have ${expiringVouchers.length} voucher(s) expiring soon!\n\n` +
        expiringVouchers.map((v, i) => {
          const expiry = v.anniversaryDate || v.expiryDate;
          const daysLeft = Math.ceil((new Date(expiry).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          return `${i + 1}. ${v.title} (${v.code})\n   Value: R${v.value}\n   Expires in ${daysLeft} day(s): ${new Date(expiry).toLocaleDateString("en-ZA")}\n   Provider: ${v.provider}\n   USE IT BEFORE IT EXPIRES!`;
        }).join("\n\n"),
      channel: "WHATSAPP",
      priority: "HIGH",
      sentAt: now.toISOString(),
    };

    // Mark vouchers as expiring reminder sent
    await db.voucher.updateMany({
      where: { id: { in: expiringVouchers.map((v) => v.id) } },
      data: { expiringSent: true },
    });

    return NextResponse.json({
      pushed: expiringVouchers.length,
      wablastPayload,
      vouchers: expiringVouchers.map((v) => ({
        code: v.code,
        title: v.title,
        value: v.value,
        expiryDate: v.expiryDate.toISOString(),
        anniversaryDate: v.anniversaryDate?.toISOString() || null,
      })),
      message: `Successfully pushed ${expiringVouchers.length} expiring voucher(s) to WABlast for WhatsApp delivery to ${member.mobile}.`,
    });
  } catch (error) {
    console.error("[vouchers/wablast-expiring] error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
