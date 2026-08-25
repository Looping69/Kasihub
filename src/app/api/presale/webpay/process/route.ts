// Author: Klaasvaakie ( |╲ )
import { NextRequest, NextResponse } from "next/server";
import { EncoreRequestError, encoreRequest } from "@/lib/encore-client";

function processNotificationBody(req: NextRequest, text: string): unknown {
  const contentType = req.headers.get("content-type")?.toLowerCase() ?? "";
  if (contentType.includes("application/json")) return JSON.parse(text);
  if (contentType.includes("application/x-www-form-urlencoded")) return Object.fromEntries(new URLSearchParams(text));
  throw new Error("unsupported_webpay_process_content_type");
}

export async function POST(req: NextRequest) {
  try {
    const text = await req.text();
    if (!text || text.length > 16_384) return NextResponse.json({ error: "Invalid process notification" }, { status: 400 });
    const result = await encoreRequest("/presale/webhooks/webpay-process", {
      method: "POST",
      body: JSON.stringify(processNotificationBody(req, text)),
    });
    return NextResponse.json(result);
  } catch (error) {
    const status = error instanceof EncoreRequestError ? error.status : 400;
    return NextResponse.json({ error: "WebPay process notification rejected" }, { status });
  }
}
