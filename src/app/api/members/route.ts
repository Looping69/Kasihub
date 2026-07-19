// Author: Klaasvaakie ( |╲ )
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import {
  ENCORE_SESSION_COOKIE,
  EncoreRequestError,
  encoreRequest,
} from "@/lib/encore-client";
import type { Member } from "@/lib/types";

type RegisterResponse = {
  registrationId: string;
  status: string;
  nextAction: string;
  user: { profileId: string; profileNumber: string };
};
type LoginResponse = { token: string };
type ProfileResponse = { member: Member };

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.email || !body.password || !body.membershipType) {
      return NextResponse.json(
        { error: "Email, password and membership type are required" },
        { status: 400 },
      );
    }
    const profileType = body.membershipType === "COMPANY" || body.membershipType === "SOLE_PROPRIETOR" || body.membershipType === "NPO_NGO"
      ? "company"
      : body.membershipType === "INDIVIDUAL_KIDS" ? "minor" : "individual";
    const registered = await encoreRequest<RegisterResponse>("/registration/start", {
      method: "POST",
      body: JSON.stringify({
        email: body.email,
        password: body.password,
        phone: body.mobile,
        profileType,
        firstName: body.firstName,
        surname: body.lastName,
        companyName: body.companyName,
        companyRegistrationNumber: body.companyRegNo,
        idOrPassportNumber: body.idPassport,
        sarsNumber: body.sarsNumber,
        country: body.country,
        membershipPlanCode: membershipPlanCode(body.membershipType, body.citizenshipType),
        createKyc: body.instapayStatus === "PENDING",
        membershipType: body.membershipType,
        citizenshipType: body.citizenshipType,
        addressLine: body.addressLine,
        city: body.city,
        postalCode: body.postalCode,
        beneficiaryName: body.beneficiaryName,
        beneficiaryId: body.beneficiaryId,
        guardianName: body.guardianName,
        instapayAccountRef: body.instapayAccountRef,
        instapayVerifiedAt: body.instapayVerifiedAt,
        uplineProfileNumber: body.uplineProfileNumber,
        uplineConfirmed: Boolean(body.uplineConfirmed),
      }),
    });
    const login = await encoreRequest<LoginResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: body.email, password: body.password }),
    });
    const profile = await encoreRequest<ProfileResponse>("/profiles/me", {}, login.token);
    const response = NextResponse.json(
      {
        member: profile.member,
        profileNumber: registered.user.profileNumber,
        registrationId: registered.registrationId,
        status: registered.status,
        nextAction: registered.nextAction,
      },
      { status: 201 },
    );
    setSessionCookie(response, login.token);
    return response;
  } catch (error) {
    const status = error instanceof EncoreRequestError ? error.status : 500;
    return NextResponse.json(
      { error: status === 409 ? "A member with these identity details already exists." : "Encore registration failed" },
      { status },
    );
  }
}

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ENCORE_SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  try {
    return NextResponse.json(await encoreRequest<ProfileResponse>("/profiles/me", {}, token));
  } catch (error) {
    const status = error instanceof EncoreRequestError ? error.status : 500;
    return NextResponse.json({ error: "Unable to load member from Encore" }, { status });
  }
}

function membershipPlanCode(membershipType: string, citizenshipType?: string): string {
  const international = ["SA_CITIZEN_ABROAD", "FOREIGN_CITIZEN_ABROAD", "INTL_COMPANY"].includes(citizenshipType ?? "");
  const company = ["COMPANY", "SOLE_PROPRIETOR", "NPO_NGO"].includes(membershipType);
  return `${company ? "COMPANY" : "INDIVIDUAL"}_${international ? "INTERNATIONAL" : "LOCAL"}`;
}

function setSessionCookie(response: NextResponse, token: string) {
  response.cookies.set(ENCORE_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}
