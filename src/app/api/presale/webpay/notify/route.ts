// Author: Klaasvaakie ( |╲ )
import { NextRequest, NextResponse } from "next/server";
import { EncoreRequestError, encoreRequest } from "@/lib/encore-client";

function notificationBody(req: NextRequest, text: string): unknown {
  const contentType = req.headers.get("content-type")?.toLowerCase() ?? "";
  if (contentType.includes("application/json")) return JSON.parse(text);
  if (contentType.includes("application/x-www-form-urlencoded")) {
    return Object.fromEntries(new URLSearchParams(text));
  }
  throw new Error("unsupported_webpay_content_type");
}

export async function POST(req: NextRequest) {
  try {
    const text = await req.text();
    if (!text || text.length > 32_768) return NextResponse.json({ error: "Invalid notification" }, { status: 400 });
    const body = notificationBody(req, text);
    const result = await encoreRequest("/presale/webhooks/webpay", {
      method: "POST",
      body: JSON.stringify(body),
    });
    return NextResponse.json(result);
  } catch (error) {
    const status = error instanceof EncoreRequestError ? error.status : 400;
    return NextResponse.json({ error: "WebPay notification rejected" }, { status });
  }
}
