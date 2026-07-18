// Author: Klaasvaakie ( |╲ )
import { NextRequest, NextResponse } from "next/server";
import { EncoreRequestError, encoreRequest, encoreSessionToken } from "@/lib/encore-client";

type Version = { config_key: string; version: number; config: Record<string, unknown>; effective_from: string };

export async function GET() {
  const token = await encoreSessionToken();
  if (!token) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  try {
    const { versions } = await encoreRequest<{ versions: Version[] }>("/admin/config", {}, token);
    const latest = new Map<string, Version>();
    for (const version of versions) if (!latest.has(version.config_key)) latest.set(version.config_key, version);
    const raw = Array.from(latest.values()).map((version) => ({ id: `${version.config_key}-${version.version}`, key: version.config_key, value: String(version.config.value ?? JSON.stringify(version.config)), category: version.config_key.includes("_") ? version.config_key.split("_")[0] : "general", updatedAt: version.effective_from }));
    const settings: Record<string, { key: string; value: string }[]> = {};
    for (const setting of raw) (settings[setting.category] ??= []).push({ key: setting.key, value: setting.value });
    return NextResponse.json({ settings, raw });
  } catch (error) {
    return failure(error);
  }
}

export async function PUT(req: NextRequest) {
  const token = await encoreSessionToken();
  if (!token) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const body = await req.json();
  if (!body.key || body.value === undefined) return NextResponse.json({ error: "key and value are required" }, { status: 400 });
  try {
    await encoreRequest(`/admin/config/${encodeURIComponent(body.key)}/version`, { method: "POST", body: JSON.stringify({ config: { value: String(body.value) } }) }, token);
    return NextResponse.json({ setting: { key: body.key, value: String(body.value), updatedAt: new Date().toISOString() } });
  } catch (error) {
    return failure(error);
  }
}

function failure(error: unknown) {
  const status = error instanceof EncoreRequestError ? error.status : 500;
  return NextResponse.json({ error: "Encore setting operation failed" }, { status });
}
