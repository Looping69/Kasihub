import { NextRequest, NextResponse } from "next/server";

// GET /api/legal?type=terms|tax|privacy - return legal document content
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") || "terms";

    const documents: Record<string, { title: string; lastUpdated: string; content: { heading: string; body: string }[] }> = {
      terms: {
        title: "Terms & Conditions",
        lastUpdated: "1 July 2025",
        content: [
          {
            heading: "1. Acceptance of Terms",
            body: "By registering as a member of KaSiHUB (\"the Platform\"), you agree to be bound by these Terms and Conditions. KaSiHUB is operated by Solidus Holdings (Pty) Ltd and provides a hybrid ecosystem connecting members to shares, marketplace, mall, and the Roots CO-OP Bank. If you do not agree to these terms, you must not register or use the Platform.",
          },
          {
            heading: "2. Membership",
            body: "Membership is open to South African citizens, foreign citizens residing in South Africa, SA CIPC-registered companies, sole proprietors, NPOs/NGOs, and international individuals and companies. Each member is assigned a unique profile number linked to their ID, passport, or company registration number. Only one profile per individual or entity is permitted. The only exception is profile inheritance, which requires Exco approval.",
          },
          {
            heading: "3. Subscription Fees",
            body: "South African members pay monthly subscription fees via InstaPay Gini: Individual R140, Company/Sole Proprietor R300, NPO/NGO R250. International members pay via Bankus: Individual Adult $30, Individual Kid $30, Company $50. Free membership is available with limited features. Subscription fees are non-refundable once processed.",
          },
          {
            heading: "4. Eco-System (5×6 Structure)",
            body: "Members are placed in a 5×6 Eco-System structure that fills from top-left to bottom-right. R47 of each R140 subscription is distributed up 6 levels. No recruitment is required to earn from the Eco-System. Spillover from upline automatically fills downline positions.",
          },
          {
            heading: "5. KasiShares",
            body: "KasiShares are Class B private shares sold by Solidus Holdings (Pty) Ltd exclusively on the KaSiHUB Platform. Shares are sold in phases at prices set per phase. Shareholders receive daily dividends from KasiMall profits and may receive additional dividends declared by KasiMall from time to time. Share certificates are digital and are re-issued when additional shares are purchased.",
          },
          {
            heading: "6. KasiPool Distributions",
            body: "The Platform operates three distribution pools: (1) Pioneer KasiPool — 1% of KasiMall and KasiMarketplace profits shared among the 200 Roots Bank pioneers; (2) KasiMarketplace Pool — shared among paid enablers; (3) Kasi Shareholders Pool — shared among KasiShare holders. Distributions are paid nightly at 12:00 SAST into members' Roots Bank or InstaPay accounts.",
          },
          {
            heading: "7. Tax Compliance",
            body: "Members who earn more than R7,000 per month from the Platform will have 25% tax deducted from their earnings. An IRP5 form will be provided at the end of each tax year. The Platform will notify its auditors automatically when a member's monthly earnings exceed the R7,000 threshold.",
          },
          {
            heading: "8. Roots CO-OP Bank",
            body: "Roots CO-OP Bank is a separate legal entity from KaSiHUB. Pioneer members purchase 1 share at R500 to constitute the bank. Pioneer members share in the 1% PioneerPool for life. Banking services are provided by Roots CO-OP Bank once fully registered and operational.",
          },
          {
            heading: "9. Limitation of Liability",
            body: "Solidus Holdings (Pty) Ltd shall not be liable for any indirect, incidental, or consequential damages arising from the use of the Platform. The Platform is provided \"as is\" without warranties of any kind. Members participate in the Eco-System, shares, and pools at their own risk.",
          },
          {
            heading: "10. Amendments",
            body: "Solidus Holdings (Pty) Ltd reserves the right to amend these Terms and Conditions at any time. Members will be notified of material changes via email. Continued use of the Platform after amendments constitutes acceptance of the updated terms.",
          },
        ],
      },
      tax: {
        title: "Tax Compliance",
        lastUpdated: "1 July 2025",
        content: [
          {
            heading: "Tax Threshold & Withholding",
            body: "In accordance with South African Revenue Service (SARS) regulations, KaSiHUB deducts 25% tax from members whose monthly earnings from the Platform exceed R7,000. This threshold applies to the combined earnings from the Eco-System, KasiPool distributions, KasiShare dividends, and PioneerPool payouts.",
          },
          {
            heading: "IRP5 Issuance",
            body: "An IRP5 form will be issued to each tax-eligible member at the end of each tax year (28 February). The IRP5 will detail all earnings and tax deductions for the year. Members must use this document when filing their annual SARS tax return.",
          },
          {
            heading: "Auditor Notification",
            body: "KaSiHUB automatically notifies its appointed auditors when a member's monthly earnings exceed the R7,000 threshold. This ensures compliance with anti-money laundering (AML) regulations and the Financial Intelligence Centre Act (FICA). Members may be contacted by the auditors for verification purposes.",
          },
          {
            heading: "SARS Registration",
            body: "All members earning above the tax threshold must have a valid SARS tax number. Members can provide their SARS number during registration or update it in their Profile. Members without a SARS number will be assisted in obtaining one.",
          },
          {
            heading: "International Members",
            body: "International members are responsible for complying with the tax laws of their country of residence. KaSiHUB does not withhold tax for international members. International members should consult a tax professional regarding their reporting obligations.",
          },
          {
            heading: "Record Keeping",
            body: "KaSiHUB maintains detailed records of all member earnings, tax deductions, and distributions for a minimum of 5 years as required by SARS. Members can access their transaction history and download statements from their Profile at any time.",
          },
        ],
      },
      privacy: {
        title: "Privacy Policy",
        lastUpdated: "1 July 2025",
        content: [
          {
            heading: "Information We Collect",
            body: "KaSiHUB collects personal information including: name, ID/passport number, SARS number, email address, mobile number, residential address, and beneficiary details. We also collect transaction data, Eco-System placement information, share ownership records, and pool distribution history. For SA members, we collect InstaPay Gini account verification status.",
          },
          {
            heading: "How We Use Your Information",
            body: "Your information is used to: (1) create and manage your KaSiHUB membership; (2) place you in the Eco-System structure; (3) process subscription payments via InstaPay Gini or Bankus; (4) distribute KasiPool, PioneerPool, and ShareholderPool payouts; (5) issue KasiShare certificates; (6) comply with SARS tax reporting requirements; (7) verify your identity for FICA compliance.",
          },
          {
            heading: "Information Sharing",
            body: "We share your information with: (1) Roots CO-OP Bank for account opening and payment processing; (2) InstaPay Gini for subscription payment verification; (3) Bankus for international payment processing; (4) our appointed auditors when earnings exceed R7,000/month; (5) SARS as required by law. We do not sell your personal information to third parties.",
          },
          {
            heading: "Data Security",
            body: "KaSiHUB employs industry-standard security measures including encrypted data transmission, secure data storage, and access controls. Your ID/passport number and SARS number are stored encrypted. Access to personal data is restricted to authorized personnel only. We conduct regular security audits to ensure data protection.",
          },
          {
            heading: "Your Rights",
            body: "Under the Protection of Personal Information Act (POPIA), you have the right to: (1) access your personal data; (2) correct inaccurate data; (3) request deletion of your data (subject to legal retention requirements); (4) object to the processing of your data; (5) withdraw consent for data processing. To exercise these rights, contact privacy@kasihub.co.za.",
          },
          {
            heading: "Data Retention",
            body: "We retain your personal information for the duration of your membership and for 5 years thereafter, as required by SARS and FICA regulations. Transaction records are retained for 5 years. Share certificate records are retained permanently.",
          },
          {
            heading: "Cookies & Analytics",
            body: "KaSiHUB uses essential cookies to maintain your session and provide core functionality. We use anonymous analytics to improve the Platform. We do not use advertising cookies or share analytics data with third-party advertisers.",
          },
          {
            heading: "Contact",
            body: "For privacy-related questions or requests, contact our Information Officer at: privacy@kasihub.co.za or +27 11 000 0000. Solidus Holdings (Pty) Ltd, 1 Solidus Way, Johannesburg, South Africa.",
          },
        ],
      },
    };

    const doc = documents[type];
    if (!doc) {
      return NextResponse.json({ error: "Invalid document type" }, { status: 400 });
    }

    return NextResponse.json({ document: doc });
  } catch (error) {
    console.error("[legal] error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
