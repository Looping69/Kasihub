import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/admin/settings - all settings grouped by category
export async function GET() {
  try {
    const settings = await db.setting.findMany({ orderBy: { category: "asc" } });
    const grouped: Record<string, { key: string; value: string }[]> = {};
    for (const s of settings) {
      if (!grouped[s.category]) grouped[s.category] = [];
      grouped[s.category].push({ key: s.key, value: s.value });
    }
    return NextResponse.json({ settings: grouped, raw: settings });
  } catch (error) {
    console.error("[admin/settings] error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT /api/admin/settings - update a setting value
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { key, value } = body;

    if (!key || value === undefined) {
      return NextResponse.json({ error: "key and value are required" }, { status: 400 });
    }

    const existing = await db.setting.findUnique({ where: { key } });
    if (!existing) {
      return NextResponse.json({ error: "Setting not found" }, { status: 404 });
    }

    const updated = await db.setting.update({
      where: { key },
      data: { value: String(value) },
    });

    return NextResponse.json({ setting: { ...updated, updatedAt: updated.updatedAt.toISOString() } });
  } catch (error) {
    console.error("[admin/settings/update] error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
