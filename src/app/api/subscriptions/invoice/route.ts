import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/subscriptions/invoice?memberId=xxx&subscriptionId=xxx
// Returns a downloadable invoice PDF for a subscription payment.
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const memberId = searchParams.get("memberId");
    const subscriptionId = searchParams.get("subscriptionId");

    if (!memberId) {
      return NextResponse.json({ error: "memberId is required" }, { status: 400 });
    }

    const member = await db.member.findUnique({ where: { id: memberId } });
    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    let subscription;
    if (subscriptionId) {
      subscription = await db.subscription.findUnique({ where: { id: subscriptionId } });
    } else {
      // Get the latest subscription
      subscription = await db.subscription.findFirst({
        where: { memberId },
        orderBy: { createdAt: "desc" },
      });
    }

    if (!subscription) {
      return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
    }

    // Generate a simple invoice PDF as a data URI (text-based PDF)
    const invoiceNumber = `INV-${subscription.period}-${subscription.id.slice(-6).toUpperCase()}`;
    const issueDate = new Date(subscription.createdAt).toLocaleDateString("en-ZA");
    const memberName = member.companyName || `${member.firstName} ${member.lastName}`;

    const amount = subscription.amount.toFixed(2);
    const vat = (subscription.amount * 0.15).toFixed(2);
    const subtotal = (subscription.amount / 1.15).toFixed(2);

    const pdfContent = generateInvoicePDF({
      invoiceNumber,
      issueDate,
      period: subscription.period,
      memberName,
      memberEmail: member.email,
      memberMobile: member.mobile,
      profileNumber: member.profileNumber,
      description: `KaSiHUB Membership Subscription — ${subscription.period}`,
      subtotal,
      vat,
      total: amount,
      currency: subscription.currency,
      paymentMethod: subscription.method,
      status: subscription.status,
    });

    return new NextResponse(pdfContent, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${invoiceNumber}.pdf"`,
      },
    });
  } catch (error) {
    console.error("[subscriptions/invoice] error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Minimal PDF generator (text-based, no external deps)
function generateInvoicePDF(data: {
  invoiceNumber: string;
  issueDate: string;
  period: string;
  memberName: string;
  memberEmail: string;
  memberMobile: string;
  profileNumber: string;
  description: string;
  subtotal: string;
  vat: string;
  total: string;
  currency: string;
  paymentMethod: string;
  status: string;
}): string {
  const c = data.currency;
  const lines = [
    "KaSiHUB - Tax Invoice",
    `Invoice: ${data.invoiceNumber}`,
    `Date: ${data.issueDate}`,
    `Period: ${data.period}`,
    "",
    "Billed To:",
    data.memberName,
    `Profile: ${data.profileNumber}`,
    data.memberEmail,
    data.memberMobile,
    "",
    "Description                          Subtotal         VAT(15%)       Total",
    `${data.description}         ${c} ${data.subtotal}      ${c} ${data.vat}    ${c} ${data.total}`,
    "",
    `Payment Method: ${data.paymentMethod}`,
    `Status: ${data.status}`,
    "",
    "Issued by: Solidus Holdings (Pty) Ltd",
    "FNB Gold Business Account: 63212306319",
    "Branch Code: 210835",
    "",
    "Thank you for your KaSiHUB membership!",
    "This is a computer-generated invoice and does not require a signature.",
  ];

  const content = lines.join("\n");
  const wrapped = content.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

  // Minimal valid PDF structure
  const pdf = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length ${wrapped.length + 50} >>
stream
BT
/F1 10 Tf
50 800 Td
14 TL
(${wrapped}) Tj
ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000241 00000 n 
0000000${(300 + wrapped.length).toString().padStart(7, "0")} 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
${400 + wrapped.length}
%%EOF`;

  return pdf;
}
