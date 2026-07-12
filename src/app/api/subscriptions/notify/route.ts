import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST /api/subscriptions/notify
// Sends WhatsApp renewal reminders at 5, 3, and 1 day(s) before subscription renewal.
// In production, this is triggered by a daily cron job. Here it's an API endpoint.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { memberId, daysBefore } = body; // daysBefore: 5 | 3 | 1

    if (!memberId || ![5, 3, 1].includes(daysBefore)) {
      return NextResponse.json({ error: "memberId and daysBefore (5, 3, or 1) are required" }, { status: 400 });
    }

    const member = await db.member.findUnique({ where: { id: memberId } });
    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // Check if this notification was already sent
    const existing = await db.subscriptionNotification.findFirst({
      where: { memberId, daysBefore },
    });
    if (existing) {
      return NextResponse.json({
        sent: false,
        message: `WhatsApp reminder for ${daysBefore} day(s) already sent on ${new Date(existing.sentAt).toLocaleDateString("en-ZA")}.`,
        existing,
      });
    }

    // Build the WhatsApp message
    const messages: Record<number, string> = {
      5: `Hi ${member.firstName}, your KaSiHUB subscription (${member.subscriptionCurrency} ${member.subscriptionAmount}/month) renews in 5 days. Please ensure your ${member.paymentMethod === "INSTAPAY" ? "InstaPay Gini" : "Bankus"} account has sufficient funds to avoid service interruption.`,
      3: `Hi ${member.firstName}, reminder — your KaSiHUB subscription renews in 3 days. Top up your ${member.paymentMethod === "INSTAPAY" ? "InstaPay Gini" : "Bankus"} account to keep your Eco-System position and pool earnings active.`,
      1: `URGENT ${member.firstName}: Your KaSiHUB subscription renews TOMORROW. Ensure your ${member.paymentMethod === "INSTAPAY" ? "InstaPay Gini" : "Bankus"} account is funded to avoid losing access to your pools, shares, and Eco-System earnings.`,
    };

    const message = messages[daysBefore];

    // Simulate WABlast WhatsApp API call
    const wablastPayload = {
      recipient: member.mobile,
      recipientName: `${member.firstName} ${member.lastName}`,
      message,
      channel: "WHATSAPP",
      priority: daysBefore === 1 ? "HIGH" : "NORMAL",
      sentAt: new Date().toISOString(),
    };

    // Record the notification
    const notification = await db.subscriptionNotification.create({
      data: {
        memberId,
        daysBefore,
        channel: "WHATSAPP",
        status: "SENT",
        message,
      },
    });

    return NextResponse.json({
      sent: true,
      notification: {
        ...notification,
        sentAt: notification.sentAt.toISOString(),
      },
      wablastPayload,
      message: `WhatsApp renewal reminder (${daysBefore} day(s) before) sent to ${member.mobile}.`,
    });
  } catch (error) {
    console.error("[subscriptions/notify] error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// GET /api/subscriptions/notify?memberId=xxx - get notification history
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const memberId = searchParams.get("memberId");
    if (!memberId) {
      return NextResponse.json({ error: "memberId is required" }, { status: 400 });
    }

    const notifications = await db.subscriptionNotification.findMany({
      where: { memberId },
      orderBy: { sentAt: "desc" },
    });

    return NextResponse.json({
      notifications: notifications.map((n) => ({
        ...n,
        sentAt: n.sentAt.toISOString(),
      })),
      sent5Days: notifications.some((n) => n.daysBefore === 5),
      sent3Days: notifications.some((n) => n.daysBefore === 3),
      sent1Day: notifications.some((n) => n.daysBefore === 1),
    });
  } catch (error) {
    console.error("[subscriptions/notify] error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
