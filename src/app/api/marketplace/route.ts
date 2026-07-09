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

    let recentOrders: { id: string; productName: string; amount: number; commission: number; createdAt: string }[] = [];
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
        createdAt: o.createdAt.toISOString(),
      }));
    }

    return NextResponse.json({
      products,
      recentOrders,
    });
  } catch (error) {
    console.error("[marketplace] error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
