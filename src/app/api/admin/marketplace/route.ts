import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/admin/marketplace - all products + recent orders
export async function GET() {
  try {
    const [products, orders] = await Promise.all([
      db.marketplaceProduct.findMany({ orderBy: { popular: "desc" } }),
      db.marketplaceOrder.findMany({
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { member: { select: { profileNumber: true, firstName: true, lastName: true, companyName: true } } },
      }),
    ]);

    // Revenue by category
    const categoryRevenueMap = new Map<string, { revenue: number; commission: number; count: number }>();
    for (const o of orders) {
      const p = products.find((x) => x.name === o.productName);
      const cat = p?.category || "OTHER";
      const cur = categoryRevenueMap.get(cat) || { revenue: 0, commission: 0, count: 0 };
      cur.revenue += o.amount;
      cur.commission += o.commission;
      cur.count += 1;
      categoryRevenueMap.set(cat, cur);
    }
    const categoryStats = Array.from(categoryRevenueMap.entries()).map(([category, stats]) => ({
      category,
      revenue: parseFloat(stats.revenue.toFixed(2)),
      commission: parseFloat(stats.commission.toFixed(2)),
      orderCount: stats.count,
    }));

    const totalRevenue = orders.reduce((s, o) => s + o.amount, 0);
    const totalCommission = orders.reduce((s, o) => s + o.commission, 0);

    return NextResponse.json({
      products,
      orders: orders.map((o) => ({
        ...o,
        createdAt: o.createdAt.toISOString(),
        member: {
          profileNumber: o.member.profileNumber,
          name: o.member.companyName || `${o.member.firstName} ${o.member.lastName}`,
        },
      })),
      categoryStats,
      totalRevenue: parseFloat(totalRevenue.toFixed(2)),
      totalCommission: parseFloat(totalCommission.toFixed(2)),
      totalOrders: orders.length,
    });
  } catch (error) {
    console.error("[admin/marketplace] error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/admin/marketplace - create a new product
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, description, category, provider, price, commissionPct, imageColor, rating, popular } = body;

    if (!name || !description || !category || !provider || price === undefined) {
      return NextResponse.json({ error: "name, description, category, provider, price are required" }, { status: 400 });
    }

    const product = await db.marketplaceProduct.create({
      data: {
        name,
        description,
        category,
        provider,
        price: parseFloat(price),
        commissionPct: commissionPct ? parseFloat(commissionPct) : 0,
        imageColor: imageColor || "emerald",
        rating: rating ? parseFloat(rating) : 4.5,
        popular: popular || false,
        currency: "ZAR",
      },
    });

    return NextResponse.json({ product }, { status: 201 });
  } catch (error) {
    console.error("[admin/marketplace/create] error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH /api/admin/marketplace - update a product
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { productId, ...updates } = body;

    if (!productId) {
      return NextResponse.json({ error: "productId is required" }, { status: 400 });
    }

    const data: Record<string, unknown> = {};
    for (const k of ["name", "description", "category", "provider", "imageColor"]) {
      if (updates[k] !== undefined) data[k] = updates[k];
    }
    if (updates.price !== undefined) data.price = parseFloat(updates.price);
    if (updates.commissionPct !== undefined) data.commissionPct = parseFloat(updates.commissionPct);
    if (updates.rating !== undefined) data.rating = parseFloat(updates.rating);
    if (updates.popular !== undefined) data.popular = updates.popular;

    const product = await db.marketplaceProduct.update({
      where: { id: productId },
      data,
    });

    return NextResponse.json({ product });
  } catch (error) {
    console.error("[admin/marketplace/update] error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/admin/marketplace - delete a product
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const productId = searchParams.get("productId");
    if (!productId) {
      return NextResponse.json({ error: "productId is required" }, { status: 400 });
    }
    await db.marketplaceProduct.delete({ where: { id: productId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[admin/marketplace/delete] error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
