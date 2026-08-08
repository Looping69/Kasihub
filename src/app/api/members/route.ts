// Author: Klaasvaakie ( |╲ )
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import {
  ENCORE_SESSION_COOKIE,
  EncoreRequestError,
  encoreRequest,
} from "@/lib/encore-client";
import type { Member } from "@/lib/types";

type RegistrationPolicy = {
  isInternational: boolean;
  kycRail: "instapay" | "kasihub_international";
  paymentRail: "instapay" | "usdt";
  profileType: "individual" | "company" | "minor";
  membershipPlanCode: "INDIVIDUAL_LOCAL" | "INDIVIDUAL_INTERNATIONAL" | "COMPANY_LOCAL" | "COMPANY_INTERNATIONAL";
  kycRequired: true;
};

type RegisterResponse = {
  registrationId: string;
  status: string;
  nextAction: string;
  user: { profileId: string; profileNumber: string };
};
type LoginResponse = { token: string };
type ProfileResponse = { member: Member };
type KycCaseResponse = { id: string; status: string; provider: "kasihub_international" };

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.email || !body.password || !body.membershipType || !body.citizenshipType) {
      return NextResponse.json(
        { error: "Email, password, membership type and citizenship type are required" },
        { status: 400 },
      );
    }

    // Server-authoritative policy. The browser may describe the applicant but may
    // not select profile type, membership plan, KYC provider, or payment rail.
    const policy = await encoreRequest<RegistrationPolicy>("/routing/registration", {
      method: "POST",
      body: JSON.stringify({
        citizenshipType: body.citizenshipType,
        membershipType: body.membershipType,
      }),
    });

    const registered = await encoreRequest<RegisterResponse>("/registration/start", {
      method: "POST",
      body: JSON.stringify({
        email: body.email,
        password: body.password,
        phone: body.mobile,
        profileType: policy.profileType,
        firstName: body.firstName,
        surname: body.lastName,
        companyName: body.companyName,
        companyRegistrationNumber: body.companyRegNo,
        idOrPassportNumber: body.idPassport,
        sarsNumber: body.sarsNumber,
        country: body.country,
        membershipPlanCode: policy.membershipPlanCode,
        createKyc: policy.kycRail === "instapay",
        membershipType: body.membershipType,
        citizenshipType: body.citizenshipType,
        addressLine: body.addressLine,
        city: body.city,
        postalCode: body.postalCode,
        beneficiaryName: body.beneficiaryName,
        beneficiaryId: body.beneficiaryId,
        guardianName: body.guardianName,
        // InstaPay verification state is intentionally not accepted from the browser.
        // Provider verification must update authoritative backend state separately.
        uplineProfileNumber: body.uplineProfileNumber,
        uplineConfirmed: Boolean(body.uplineConfirmed),
      }),
    });

    const login = await encoreRequest<LoginResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: body.email, password: body.password }),
    });

    let internationalKyc: KycCaseResponse | null = null;
    if (policy.kycRail === "kasihub_international") {
      internationalKyc = await encoreRequest<KycCaseResponse>("/kyc/international/cases", {
        method: "POST",
        body: JSON.stringify({ profileId: registered.user.profileId }),
      }, login.token);
    }

    const profile = await encoreRequest<ProfileResponse>("/profiles/me", {}, login.token);
    const response = NextResponse.json(
      {
        member: profile.member,
        profileNumber: registered.user.profileNumber,
        registrationId: registered.registrationId,
        status: registered.status,
        nextAction: registered.nextAction,
        routing: {
          kycRail: policy.kycRail,
          paymentRail: policy.paymentRail,
        },
        internationalKyc,
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
