// Author: Klaasvaakie ( |╲ )
import { NextResponse } from "next/server";
import {
  ENCORE_SESSION_COOKIE,
  EncoreRequestError,
  encoreRequest,
  presaleSessionToken,
} from "@/lib/encore-client";

type ConversionResponse = {
  token: string;
  profileId: string;
  profileNumber: string;
  subscription: { id: string; paymentId: string; status: string; planName: string; amount: number; currency: string };
};

export async function POST() {
  const presaleToken = await presaleSessionToken();
  if (!presaleToken) return NextResponse.json({ error: "KaSiShares login is required" }, { status: 401 });
  try {
    const converted = await encoreRequest<ConversionResponse>(
      "/presale/shareholder/ecosystem-account",
      { method: "POST" },
      presaleToken,
    );
    const response = NextResponse.json({
      profileId: converted.profileId,
      profileNumber: converted.profileNumber,
      subscription: converted.subscription,
      redirectTo: "/",
    });
    response.cookies.set(ENCORE_SESSION_COOKIE, converted.token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return response;
  } catch (error) {
    const status = error instanceof EncoreRequestError ? error.status : 500;
    const message = status === 412
      ? "Only verified shareholders with issued shares can open a member account."
      : status === 401 || status === 403
        ? "KaSiShares login is required"
        : "The KaSiHub member account could not be opened.";
    return NextResponse.json({ error: message }, { status });
  }
}
