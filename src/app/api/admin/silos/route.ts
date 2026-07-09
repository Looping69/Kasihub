import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/admin/silos - list all silo configs
export async function GET() {
  try {
    const silos = await db.siloConfig.findMany({ orderBy: { sortOrder: "asc" } });
    return NextResponse.json({
      silos: silos.map((s) => ({ ...s, updatedAt: s.updatedAt.toISOString() })),
      total: silos.reduce((s, x) => s + x.percentage, 0),
    });
  } catch (error) {
    console.error("[admin/silos] error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH /api/admin/silos - update silo percentages (Exco-editable)
// Body: { silos: [{ id, percentage, name?, description? }] }
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { silos } = body;

    if (!Array.isArray(silos)) {
      return NextResponse.json({ error: "silos array is required" }, { status: 400 });
    }

    // Validate total = 100
    const total = silos.reduce((s: number, x: { percentage: number }) => s + parseFloat(x.percentage), 0);
    if (Math.abs(total - 100) > 0.01) {
      return NextResponse.json(
        { error: `Silo percentages must total 100%. Current total: ${total}%` },
        { status: 400 }
      );
    }

    const updated = [];
    for (const s of silos) {
      const u = await db.siloConfig.update({
        where: { id: s.id },
        data: {
          percentage: parseFloat(s.percentage),
          ...(s.name ? { name: s.name } : {}),
          ...(s.description !== undefined ? { description: s.description } : {}),
        },
      });
      updated.push({ ...u, updatedAt: u.updatedAt.toISOString() });
    }

    return NextResponse.json({
      silos: updated,
      total: parseFloat(total.toFixed(2)),
    });
  } catch (error) {
    console.error("[admin/silos/update] error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
