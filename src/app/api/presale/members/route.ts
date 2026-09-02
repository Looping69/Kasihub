// Author: Klaasvaakie ( |╲ )
import { NextRequest, NextResponse } from "next/server";
import { PRESALE_SESSION_COOKIE, EncoreRequestError, encoreRequest, sessionCookieOptions } from "@/lib/encore-client";

type RegistrationResponse = {
  token: string;
  profileId: string;
  profileNumber: string;
  applicationId: string;
  created: boolean;
  emailStatus: "sent" | "failed" | "existing";
};

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const registration = await encoreRequest<RegistrationResponse>("/presale/members", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const response = NextResponse.json({
      profileId: registration.profileId,
      profileNumber: registration.profileNumber,
      applicationId: registration.applicationId,
      created: registration.created,
      emailStatus: registration.emailStatus,
    }, { status: registration.created ? 201 : 200 });
    response.cookies.set(PRESALE_SESSION_COOKIE, registration.token, sessionCookieOptions());
    return response;
  } catch (error) {
    const status = error instanceof EncoreRequestError ? error.status : 500;
    const message = status === 401
      ? "The email or password is incorrect."
      : status === 403
        ? "This invitation cannot be used for that email address."
        : status === 400
          ? "Please check the registration details."
          : status === 409
            ? "An account already exists for this email. Use the existing account password."
            : status === 412
              ? "This account cannot currently be used for shareholder registration."
          : "Member registration is temporarily unavailable.";
    return NextResponse.json({ error: message }, { status });
  }
}
