import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST /api/marketplace/order - place a marketplace order (paid from Roots Bank account)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { memberId, productId } = body;

    if (!memberId || !productId) {
      return NextResponse.json({ error: "memberId and productId are required" }, { status: 400 });
    }

    const product = await db.marketplaceProduct.findUnique({ where: { id: productId } });
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const member = await db.member.findUnique({ where: { id: memberId } });
    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    const commission = parseFloat((product.price * product.commissionPct / 100).toFixed(2));

    const order = await db.marketplaceOrder.create({
      data: {
        memberId,
        productId,
        productName: product.name,
        amount: product.price,
        commission,
        status: "COMPLETED",
      },
    });

    // Record member transaction (debit)
    await db.transaction.create({
      data: {
        memberId,
        type: "MARKETPLACE",
        amount: -product.price,
        description: `${product.name} — ${product.provider}`,
        status: "COMPLETED",
      },
    });

    // Add commission to KasiPool (we just record a pool distribution to the member as simulation of shared pool benefit)
    // In production this would be aggregated; here we credit a small portion back as illustration
    const poolBenefit = parseFloat((commission * 0.05).toFixed(2));
    if (poolBenefit > 0) {
      await db.kasiPoolDistribution.create({
        data: {
          memberId,
          amount: poolBenefit,
          source: "MARKETPLACE",
          status: "PAID",
        },
      });
    }

    return NextResponse.json({
      order: {
        ...order,
        createdAt: order.createdAt.toISOString(),
      },
      commission,
      poolBenefit,
    });
  } catch (error) {
    console.error("[marketplace/order] error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
