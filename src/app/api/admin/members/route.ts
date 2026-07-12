import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/admin/members - list all members with pagination + search + filter
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const kycFilter = searchParams.get("kyc") || "ALL";
    const subFilter = searchParams.get("subscription") || "ALL";
    const typeFilter = searchParams.get("type") || "ALL";
    const limit = parseInt(searchParams.get("limit") || "100");
    const offset = parseInt(searchParams.get("offset") || "0");

    const where: {
      isAdmin?: boolean;
      AND?: { OR?: { firstName?: { contains: string }; lastName?: { contains: string }; companyName?: { contains: string }; email?: { contains: string }; profileNumber?: { contains: string }; mobile?: { contains: string } }[]; kycStatus?: string; subscriptionStatus?: string; membershipType?: string }[];
    } = { isAdmin: false };

    const and: Record<string, unknown>[] = [];
    if (search) {
      and.push({
        OR: [
          { firstName: { contains: search } },
          { lastName: { contains: search } },
          { companyName: { contains: search } },
          { email: { contains: search } },
          { profileNumber: { contains: search } },
          { mobile: { contains: search } },
        ],
      });
    }
    if (kycFilter !== "ALL") and.push({ kycStatus: kycFilter });
    if (subFilter !== "ALL") and.push({ subscriptionStatus: subFilter });
    if (typeFilter !== "ALL") and.push({ membershipType: typeFilter });
    if (and.length) where.AND = and as never;

    const [members, total] = await Promise.all([
      db.member.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
        include: {
          shares: { where: { status: "ACTIVE" }, select: { quantity: true } },
          _count: { select: { transactions: true, marketplaceOrders: true } },
        },
      }),
      db.member.count({ where }),
    ]);

    return NextResponse.json({
      members: members.map((m) => ({
        id: m.id,
        profileNumber: m.profileNumber,
        membershipType: m.membershipType,
        citizenshipType: m.citizenshipType,
        firstName: m.firstName,
        lastName: m.lastName,
        companyName: m.companyName,
        email: m.email,
        country: m.country,
        mobile: m.mobile,
        kycStatus: m.kycStatus,
        kycVerifiedAt: m.kycVerifiedAt?.toISOString() || null,
        subscriptionStatus: m.subscriptionStatus,
        subscriptionAmount: m.subscriptionAmount,
        subscriptionCurrency: m.subscriptionCurrency,
        monthlyEarnings: m.monthlyEarnings,
        taxThreshold: m.taxThreshold,
        nfcTagId: m.nfcTagId,
        instapayStatus: m.instapayStatus,
        instapayVerifiedAt: m.instapayVerifiedAt?.toISOString() || null,
        instapayAccountRef: m.instapayAccountRef,
        uplineProfileNumber: m.uplineProfileNumber,
        uplineConfirmed: m.uplineConfirmed,
        createdAt: m.createdAt.toISOString(),
        shareCount: m.shares.reduce((s, x) => s + x.quantity, 0),
        transactionCount: m._count.transactions,
        orderCount: m._count.marketplaceOrders,
      })),
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error("[admin/members] error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
