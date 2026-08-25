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
  status: "kyc_pending" | "awaiting_payment";
  nextAction: "kyc" | "payment";
  routing: {
    kycRail: string;
    paymentRail: string;
  };
  user: { profileId: string; profileNumber: string };
};
type LoginResponse = { token: string };
type ProfileResponse = { member: Member };

function optionalString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized || undefined;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.email || !body.password || !body.membershipType || !body.citizenshipType || !body.onboardingAuthority) {
      return NextResponse.json(
        { error: "Email, password, membership type and citizenship type are required" },
        { status: 400 },
      );
    }

    // The web layer forwards applicant facts only. Encore owns all trust-bearing
    // decisions: profile type, membership plan, KYC rail and payment rail.
    const registered = await encoreRequest<RegisterResponse>("/registration/secure-start", {
      method: "POST",
      body: JSON.stringify({
        email: body.email,
        password: body.password,
        phone: optionalString(body.mobile),
        firstName: optionalString(body.firstName),
        surname: optionalString(body.lastName),
        companyName: optionalString(body.companyName),
        companyRegistrationNumber: optionalString(body.companyRegNo),
        idOrPassportNumber: optionalString(body.idPassport),
        sarsNumber: optionalString(body.sarsNumber),
        country: optionalString(body.country),
        membershipType: body.membershipType,
        citizenshipType: body.citizenshipType,
        onboardingAuthority: body.onboardingAuthority,
        addressLine: optionalString(body.addressLine),
        city: optionalString(body.city),
        postalCode: optionalString(body.postalCode),
        beneficiaryName: optionalString(body.beneficiaryName),
        beneficiaryId: optionalString(body.beneficiaryId),
        guardianName: optionalString(body.guardianName),
        uplineProfileNumber: optionalString(body.uplineProfileNumber),
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
        routing: registered.routing,
      },
      { status: 201 },
    );
    setSessionCookie(response, login.token);
    return response;
  } catch (error) {
    const status = error instanceof EncoreRequestError ? error.status : 500;
    const message = status === 409
      ? "A member with these identity details already exists."
      : status === 400
        ? "Registration details are not supported."
        : "Encore registration failed";
    return NextResponse.json({ error: message }, { status });
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

function setSessionCookie(response: NextResponse, token: string) {
  response.cookies.set(ENCORE_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}
