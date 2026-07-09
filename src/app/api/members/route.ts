import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST /api/members - create a new member (registration)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Generate a unique profile number
    const count = await db.member.count();
    const profileNumber = `KSH-${String(count + 1).padStart(6, "0")}`;

    // Determine subscription amount based on membership type
    const isCompany = body.membershipType === "COMPANY";
    const isInternational = body.country !== "South Africa";
    let subscriptionAmount = 140;
    let subscriptionCurrency = "ZAR";
    if (isCompany) {
      subscriptionAmount = isInternational ? 50 : 300;
      subscriptionCurrency = isInternational ? "USD" : "ZAR";
    } else {
      subscriptionAmount = isInternational ? 20 : 140;
      subscriptionCurrency = isInternational ? "USD" : "ZAR";
    }

    // Check for duplicate ID/Passport
    if (body.idPassport) {
      const existing = await db.member.findUnique({
        where: { idPassport: body.idPassport },
      });
      if (existing) {
        return NextResponse.json(
          { error: "A member with this ID/Passport number already exists. Only one profile per ID is allowed." },
          { status: 409 }
        );
      }
    }

    // Check for duplicate email
    const existingEmail = await db.member.findUnique({
      where: { email: body.email },
    });
    if (existingEmail) {
      return NextResponse.json(
        { error: "A member with this email already exists." },
        { status: 409 }
      );
    }

    // Generate NFC tag + Visa card last 4 + Roots Bank account
    const nfcTagId = `NFC-${profileNumber}`;
    const visaCardLast4 = String(Math.floor(Math.random() * 9000 + 1000));
    const rootsBankAccount = String(63212300000 + Math.floor(Math.random() * 99999));

    const member = await db.member.create({
      data: {
        profileNumber,
        membershipType: body.membershipType,
        firstName: body.firstName || null,
        lastName: body.lastName || null,
        companyName: body.companyName || null,
        companyRegNo: body.companyRegNo || null,
        idPassport: body.idPassport || null,
        sarsNumber: body.sarsNumber || null,
        email: body.email,
        country: body.country,
        mobile: body.mobile,
        addressLine: body.addressLine || null,
        city: body.city || null,
        postalCode: body.postalCode || null,
        profilePicture: body.profilePicture || null,
        beneficiaryName: body.beneficiaryName || null,
        beneficiaryId: body.beneficiaryId || null,
        guardianName: body.guardianName || null,
        kycStatus: body.kycStatus || "PENDING",
        subscriptionStatus: "ACTIVE",
        subscriptionAmount,
        subscriptionCurrency,
        paymentMethod: body.paymentMethod || "BANK",
        nfcTagId,
        visaCardLast4,
        rootsBankAccount,
      },
    });

    // Place member in the next open matrix spot (top-left to bottom-right fill)
    const allNodes = await db.matrixNode.findMany({ orderBy: { nodeIndex: "asc" } });
    // Find sponsor if provided
    let sponsorId: string | null = null;
    if (body.sponsorProfileNumber) {
      const sponsor = await db.member.findUnique({
        where: { profileNumber: body.sponsorProfileNumber },
      });
      if (sponsor) sponsorId = sponsor.id;
    }

    // Find next open position: BFS - first node with < 5 children gets the new member
    let parentId: string | null = null;
    let level = 0;
    let position = 0;
    let nodeIndex = allNodes.length;

    const childCountMap = new Map<string, number>();
    for (const n of allNodes) {
      if (n.parentId) {
        childCountMap.set(n.parentId, (childCountMap.get(n.parentId) || 0) + 1);
      }
    }

    for (const n of allNodes) {
      const childCount = childCountMap.get(n.id) || 0;
      if (childCount < 5) {
        parentId = n.id;
        level = n.level + 1;
        position = childCount;
        break;
      }
    }

    await db.matrixNode.create({
      data: {
        memberId: member.id,
        parentId,
        level,
        position,
        nodeIndex,
        sponsorId,
      },
    });

    // Record initial subscription payment
    await db.subscription.create({
      data: {
        memberId: member.id,
        amount: subscriptionAmount,
        currency: subscriptionCurrency,
        method: body.paymentMethod || "BANK",
        status: "PAID",
        period: new Date().toISOString().slice(0, 7),
      },
    });

    // Record transaction
    await db.transaction.create({
      data: {
        memberId: member.id,
        type: "SUBSCRIPTION",
        amount: -subscriptionAmount,
        description: `Initial ${subscriptionCurrency} ${subscriptionAmount} membership subscription`,
        status: "COMPLETED",
      },
    });

    return NextResponse.json({ member, profileNumber }, { status: 201 });
  } catch (error) {
    console.error("[members/create] error", error);
    return NextResponse.json(
      { error: "Failed to create member. " + (error as Error).message },
      { status: 500 }
    );
  }
}

// GET /api/members?memberId=xxx - get a single member
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const memberId = searchParams.get("memberId");
    if (!memberId) {
      return NextResponse.json({ error: "memberId is required" }, { status: 400 });
    }
    const member = await db.member.findUnique({ where: { id: memberId } });
    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }
    return NextResponse.json({ member });
  } catch (error) {
    console.error("[members/get] error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
