// Author: Klaasvaakie ( |╲ )
import { NextRequest, NextResponse } from "next/server";
import { EncoreRequestError, encoreRequest, encoreSessionToken } from "@/lib/encore-client";

type Product = { id: string; category: string; price: number; freePrice: number; createdAt: string };
type Order = { id: string; productId: string; productName: string; amount: number; commission: number; pricingTier: string; status: string; createdAt: string };

export async function GET() {
  const token = await encoreSessionToken();
  if (!token) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  try {
    const data = await encoreRequest<{ products: Product[]; orders: Order[] }>("/admin/marketplace", {}, token);
    const categoryMap = new Map<string, { revenue: number; commission: number; orderCount: number; freeOrders: number; paidOrders: number }>();
    for (const order of data.orders) {
      const category = data.products.find((product) => product.id === order.productId)?.category ?? "OTHER";
      const stats = categoryMap.get(category) ?? { revenue: 0, commission: 0, orderCount: 0, freeOrders: 0, paidOrders: 0 };
      stats.revenue += order.amount;
      stats.commission += order.commission;
      stats.orderCount++;
      if (order.pricingTier === "FREE") stats.freeOrders++; else stats.paidOrders++;
      categoryMap.set(category, stats);
    }
    return NextResponse.json({
      products: data.products.map((product) => ({ ...product, freePriceDelta: product.price > 0 ? Number((((product.freePrice - product.price) / product.price) * 100).toFixed(1)) : 0 })),
      orders: data.orders.map((order) => ({ ...order, member: { profileNumber: "Encore", name: "Encore member" } })),
      categoryStats: Array.from(categoryMap, ([category, stats]) => ({ category, ...stats })),
      totalRevenue: data.orders.reduce((sum, order) => sum + order.amount, 0),
      totalCommission: data.orders.reduce((sum, order) => sum + order.commission, 0),
      totalOrders: data.orders.length,
      freeMemberOrders: data.orders.filter((order) => order.pricingTier === "FREE").length,
      paidMemberOrders: data.orders.filter((order) => order.pricingTier === "PAID").length,
    });
  } catch (error) {
    return encoreError(error, "Unable to load Encore marketplace administration");
  }
}

export async function POST(req: NextRequest) {
  return mutate(req, "/admin/marketplace/products", "POST");
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  if (!body.productId) return NextResponse.json({ error: "productId is required" }, { status: 400 });
  return mutateBody(`/admin/marketplace/products/${encodeURIComponent(body.productId)}`, "PATCH", body);
}

export async function DELETE(req: NextRequest) {
  const productId = req.nextUrl.searchParams.get("productId");
  if (!productId) return NextResponse.json({ error: "productId is required" }, { status: 400 });
  return mutateBody(`/admin/marketplace/products/${encodeURIComponent(productId)}`, "DELETE", undefined);
}

async function mutate(req: NextRequest, path: string, method: string) {
  return mutateBody(path, method, await req.json());
}

async function mutateBody(path: string, method: string, body: unknown) {
  const token = await encoreSessionToken();
  if (!token) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  try {
    const data = await encoreRequest(path, { method, body: body === undefined ? undefined : JSON.stringify(body) }, token);
    return NextResponse.json(data, { status: method === "POST" ? 201 : 200 });
  } catch (error) {
    return encoreError(error, "Encore marketplace mutation failed");
  }
}

function encoreError(error: unknown, message: string) {
  const status = error instanceof EncoreRequestError ? error.status : 500;
  return NextResponse.json({ error: message }, { status });
}
