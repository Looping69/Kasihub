import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/auth/login - auto-login as the seeded demo member (Thabo Mokoena)
export async function GET(_req: NextRequest) {
  try {
    // Use the first seeded member as the demo "logged in" user
    const member = await db.member.findFirst({
      where: { profileNumber: "KSH-000001" },
    });

    if (!member) {
      return NextResponse.json(
        { error: "No demo member found. Please run the seed script." },
        { status: 404 }
      );
    }

    return NextResponse.json({ member });
  } catch (error) {
    console.error("[auth/login] error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
