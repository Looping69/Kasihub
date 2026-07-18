import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { encoreRequest, encoreSessionToken } from "@/lib/encore-client";
import type { Member, Subscription } from "@/lib/types";

export const runtime = "nodejs";

// Author: Klaasvaakie ( |╲ )
// GET /api/subscriptions/invoice?memberId=xxx&subscriptionId=xxx
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const memberId = searchParams.get("memberId");
    const subscriptionId = searchParams.get("subscriptionId");

    if (!memberId) {
      return NextResponse.json({ error: "memberId is required" }, { status: 400 });
    }

    const token = await encoreSessionToken();
    if (!token) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    const [profile, subscriptionResult] = await Promise.all([
      encoreRequest<{ member: Member }>("/profiles/me", {}, token),
      encoreRequest<{ subscription: Subscription | null }>(
        `/membership/subscriptions/${encodeURIComponent(memberId)}${subscriptionId ? `?subscriptionId=${encodeURIComponent(subscriptionId)}` : ""}`,
        {}, token,
      ),
    ]);
    const member = profile.member;
    if (member.id !== memberId) return NextResponse.json({ error: "Member identity mismatch" }, { status: 403 });
    const subscription = subscriptionResult.subscription;
    if (!subscription) {
      return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
    }

    const invoiceNumber = `INV-${subscription.period}-${subscription.id.slice(-6).toUpperCase()}`;
    const issueDate = new Intl.DateTimeFormat("en-ZA", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(subscription.createdAt));
    const memberName = member.companyName || [member.firstName, member.lastName].filter(Boolean).join(" ") || member.profileNumber;
    const subtotalValue = subscription.amount / 1.15;
    const pdfContent = await generateInvoicePDF({
      invoiceNumber,
      issueDate,
      period: subscription.period,
      memberName,
      memberEmail: member.email,
      memberMobile: member.mobile,
      profileNumber: member.profileNumber,
      description: `KaSiHUB Membership Subscription - ${subscription.period}`,
      subtotal: subtotalValue.toFixed(2),
      vat: (subscription.amount - subtotalValue).toFixed(2),
      total: subscription.amount.toFixed(2),
      currency: subscription.currency,
      paymentMethod: subscription.method,
      status: subscription.status,
    });

    return new NextResponse(Buffer.from(pdfContent), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${invoiceNumber}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("[subscriptions/invoice] error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function generateInvoicePDF(data: {
  invoiceNumber: string; issueDate: string; period: string; memberName: string;
  memberEmail: string; memberMobile: string; profileNumber: string; description: string;
  subtotal: string; vat: string; total: string; currency: string; paymentMethod: string; status: string;
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const width = page.getWidth();
  const margin = 48;
  const green = rgb(0.04, 0.42, 0.26);
  const dark = rgb(0.08, 0.12, 0.1);
  const muted = rgb(0.38, 0.43, 0.4);
  const line = rgb(0.87, 0.9, 0.88);
  const pale = rgb(0.95, 0.98, 0.96);
  const amber = rgb(0.78, 0.48, 0.08);

  const text = (value: string, x: number, y: number, size = 10, font = regular, color = dark) => {
    page.drawText(value, { x, y, size, font, color });
  };
  const right = (value: string, x: number, y: number, size = 10, font = regular, color = dark) => {
    text(value, x - font.widthOfTextAtSize(value, size), y, size, font, color);
  };
  const money = (value: string) => `${data.currency} ${value}`;

  page.drawRectangle({ x: 0, y: 760, width, height: 82, color: green });
  page.drawRectangle({ x: margin, y: 785, width: 42, height: 42, color: rgb(1, 1, 1), opacity: 0.14, borderColor: rgb(1, 1, 1), borderWidth: 1 });
  text("K", margin + 13, 796, 22, bold, rgb(1, 1, 1));
  text("KaSiHUB", margin + 56, 808, 18, bold, rgb(1, 1, 1));
  text("Hybrid Ecosystem for Community Wealth", margin + 56, 791, 8.5, regular, rgb(0.83, 0.93, 0.87));
  right("INVOICE", width - margin, 805, 20, bold, rgb(1, 1, 1));
  right(data.invoiceNumber, width - margin, 786, 9, regular, rgb(0.83, 0.93, 0.87));

  text("ISSUED BY", margin, 718, 8, bold, green);
  text("Solidus Holdings (Pty) Ltd", margin, 699, 11, bold);
  text("KaSiHUB Membership Services", margin, 683, 9, regular, muted);
  text("Johannesburg, South Africa", margin, 669, 9, regular, muted);
  text("BILLED TO", 320, 718, 8, bold, green);
  text(data.memberName, 320, 699, 11, bold);
  text(`Profile ${data.profileNumber}`, 320, 683, 9, regular, muted);
  text(data.memberEmail, 320, 669, 9, regular, muted);
  text(data.memberMobile, 320, 655, 9, regular, muted);

  page.drawLine({ start: { x: margin, y: 628 }, end: { x: width - margin, y: 628 }, thickness: 1, color: line });
  text("Invoice date", margin, 604, 8, regular, muted);
  text(data.issueDate, margin, 587, 10, bold);
  text("Billing period", 202, 604, 8, regular, muted);
  text(data.period, 202, 587, 10, bold);
  text("Payment method", 356, 604, 8, regular, muted);
  text(data.paymentMethod, 356, 587, 10, bold);
  const statusColor = data.status === "PAID" ? green : amber;
  page.drawRectangle({ x: 470, y: 581, width: 76, height: 22, color: pale, borderColor: statusColor, borderWidth: 0.8 });
  text(data.status, 486, 588, 8, bold, statusColor);

  page.drawRectangle({ x: margin, y: 520, width: width - margin * 2, height: 34, color: green });
  text("DESCRIPTION", margin + 12, 532, 8, bold, rgb(1, 1, 1));
  right("AMOUNT", width - margin - 12, 532, 8, bold, rgb(1, 1, 1));
  text(data.description, margin + 12, 492, 10, bold);
  text(`Monthly membership for billing period ${data.period}`, margin + 12, 475, 8.5, regular, muted);
  right(money(data.subtotal), width - margin - 12, 490, 10, bold);
  page.drawLine({ start: { x: margin, y: 454 }, end: { x: width - margin, y: 454 }, thickness: 1, color: line });

  const totalsX = 356;
  text("Subtotal", totalsX, 420, 9, regular, muted);
  right(money(data.subtotal), width - margin, 420, 9);
  text("VAT included (15%)", totalsX, 394, 9, regular, muted);
  right(money(data.vat), width - margin, 394, 9);
  page.drawLine({ start: { x: totalsX, y: 377 }, end: { x: width - margin, y: 377 }, thickness: 1, color: line });
  text("TOTAL", totalsX, 348, 11, bold, green);
  right(money(data.total), width - margin, 345, 17, bold, green);

  page.drawRectangle({ x: margin, y: 232, width: width - margin * 2, height: 78, color: pale, borderColor: line, borderWidth: 0.8 });
  text("PAYMENT INFORMATION", margin + 14, 288, 8, bold, green);
  text("FNB Gold Business Account", margin + 14, 268, 9, bold);
  text("Account: 63212306319", margin + 14, 251, 9, regular, muted);
  text("Branch code: 210835", 250, 251, 9, regular, muted);
  right(`Reference: ${data.profileNumber}`, width - margin - 14, 251, 9, bold);

  text("Thank you for being part of KaSiHUB.", margin, 184, 11, bold, green);
  text("This invoice was generated electronically and does not require a signature.", margin, 165, 8.5, regular, muted);
  page.drawLine({ start: { x: margin, y: 96 }, end: { x: width - margin, y: 96 }, thickness: 1, color: line });
  text("Solidus Holdings (Pty) Ltd", margin, 75, 8, bold, muted);
  right(`Invoice ${data.invoiceNumber}  |  Page 1 of 1`, width - margin, 75, 8, regular, muted);

  pdf.setTitle(`${data.invoiceNumber} - KaSiHUB Invoice`);
  pdf.setAuthor("Klaasvaakie ( |╲ )");
  pdf.setSubject(`Membership invoice for ${data.profileNumber}`);
  pdf.setCreator("KaSiHUB");
  return pdf.save();
}
