import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/auth/login?role=admin - auto-login as demo member or admin
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const role = searchParams.get("role"); // "admin" returns the admin member

    let member;
    if (role === "admin") {
      member = await db.member.findFirst({ where: { isAdmin: true } });
    } else {
      member = await db.member.findFirst({ where: { profileNumber: "KSH-000001" } });
    }

    if (!member) {
      return NextResponse.json(
        { error: role === "admin" ? "No admin member found. Please run the seed script." : "No demo member found. Please run the seed script." },
        { status: 404 }
      );
    }

    return NextResponse.json({ member });
  } catch (error) {
    console.error("[auth/login] error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
