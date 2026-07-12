import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/admin/notifications - all subscription WhatsApp notifications
export async function GET() {
  try {
    const notifications = await db.subscriptionNotification.findMany({
      orderBy: { sentAt: "desc" },
      take: 200,
      include: {
        member: {
          select: { profileNumber: true, firstName: true, lastName: true, companyName: true, mobile: true, subscriptionStatus: true },
        },
      },
    });

    const sent5Days = notifications.filter((n) => n.daysBefore === 5).length;
    const sent3Days = notifications.filter((n) => n.daysBefore === 3).length;
    const sent1Day = notifications.filter((n) => n.daysBefore === 1).length;

    // Members with upcoming renewals (mock: active members)
    const activeMembers = await db.member.count({ where: { subscriptionStatus: "ACTIVE", isAdmin: false } });

    return NextResponse.json({
      notifications: notifications.map((n) => ({
        ...n,
        sentAt: n.sentAt.toISOString(),
        member: {
          profileNumber: n.member.profileNumber,
          name: n.member.companyName || `${n.member.firstName} ${n.member.lastName}`,
          mobile: n.member.mobile,
        },
      })),
      stats: {
        total: notifications.length,
        sent5Days,
        sent3Days,
        sent1Day,
        activeMembers,
      },
    });
  } catch (error) {
    console.error("[admin/notifications] error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/admin/notifications - trigger WhatsApp reminders for all eligible members at a given day threshold
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { daysBefore } = body; // 5 | 3 | 1

    if (![5, 3, 1].includes(daysBefore)) {
      return NextResponse.json({ error: "daysBefore must be 5, 3, or 1" }, { status: 400 });
    }

    // Get all active, non-admin members who haven't received this notification
    const activeMembers = await db.member.findMany({
      where: { subscriptionStatus: "ACTIVE", isAdmin: false },
    });

    let sentCount = 0;
    const messages: Record<number, string> = {
      5: "Your KaSiHUB subscription renews in 5 days. Ensure your InstaPay Gini account is funded.",
      3: "Your KaSiHUB subscription renews in 3 days. Top up your InstaPay Gini account.",
      1: "URGENT: Your KaSiHUB subscription renews TOMORROW. Fund your InstaPay Gini account now.",
    };

    for (const member of activeMembers) {
      const existing = await db.subscriptionNotification.findFirst({
        where: { memberId: member.id, daysBefore },
      });
      if (existing) continue;

      await db.subscriptionNotification.create({
        data: {
          memberId: member.id,
          daysBefore,
          channel: "WHATSAPP",
          status: "SENT",
          message: `Hi ${member.firstName}, ${messages[daysBefore]}`,
        },
      });
      sentCount++;
    }

    return NextResponse.json({
      sent: sentCount,
      totalEligible: activeMembers.length,
      daysBefore,
      message: `WhatsApp ${daysBefore}-day renewal reminder sent to ${sentCount} member(s).`,
    });
  } catch (error) {
    console.error("[admin/notifications/trigger] error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
