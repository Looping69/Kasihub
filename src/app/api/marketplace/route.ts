import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/marketplace - list all products, optionally filter by category
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const memberId = searchParams.get("memberId");

    const where: { category?: string } = {};
    if (category && category !== "ALL") {
      where.category = category;
    }

    const products = await db.marketplaceProduct.findMany({
      where,
      orderBy: { popular: "desc" },
    });

    // Determine member's pricing tier
    let isFreeMember = false;
    if (memberId) {
      const member = await db.member.findUnique({ where: { id: memberId } });
      isFreeMember = member?.membershipType === "FREE" || member?.subscriptionStatus !== "ACTIVE";
    }

    let recentOrders: { id: string; productName: string; amount: number; commission: number; pricingTier: string; createdAt: string }[] = [];
    if (memberId) {
      const orders = await db.marketplaceOrder.findMany({
        where: { memberId },
        orderBy: { createdAt: "desc" },
        take: 8,
      });
      recentOrders = orders.map((o) => ({
        id: o.id,
        productName: o.productName,
        amount: o.amount,
        commission: o.commission,
        pricingTier: o.pricingTier,
        createdAt: o.createdAt.toISOString(),
      }));
    }

    return NextResponse.json({
      products: products.map((p) => ({
        ...p,
        // Show the price the member will actually pay
        displayPrice: isFreeMember ? (p.freePrice || p.price) : p.price,
      })),
      recentOrders,
      isFreeMember,
      pricingTier: isFreeMember ? "FREE" : "PAID",
    });
  } catch (error) {
    console.error("[marketplace] error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
