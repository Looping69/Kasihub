// Author: Klaasvaakie ( |╲ )
import "server-only";
import { cookies } from "next/headers";

export const ENCORE_SESSION_COOKIE = "kasihub_session";
export const PRESALE_SESSION_COOKIE = "kasishares_session";

export function cookieDomain(): string | undefined {
  if (process.env.NODE_ENV !== "production") return undefined;
  return ".kasihub.net";
}

export function sessionCookieOptions(maxAge = 60 * 60 * 24 * 7) {
  const domain = cookieDomain();
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
    ...(domain ? { domain } : {}),
  };
}

export class EncoreRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details: unknown,
  ) {
    super(message);
    this.name = "EncoreRequestError";
  }
}

function observablePath(path: string): string {
  return path.split("?")[0].replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, ":id");
}

export async function encoreRequest<T>(
  path: string,
  init: RequestInit = {},
  token?: string,
): Promise<T> {
  const baseUrl = process.env.ENCORE_API_URL?.replace(/\/$/, "");
  if (!baseUrl) {
    throw new EncoreRequestError("Encore API is not configured", 503, null);
  }
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const startedAt = performance.now();
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers,
      cache: "no-store",
    });
  } catch (error) {
    console.error(JSON.stringify({
      event: "encore_request",
      path: observablePath(path),
      method: init.method ?? "GET",
      result: "network_error",
      durationMs: Math.round(performance.now() - startedAt),
    }));
    throw error;
  }
  const durationMs = Math.round(performance.now() - startedAt);
  if (durationMs >= 250 || !response.ok) {
    console.info(JSON.stringify({
      event: "encore_request",
      path: observablePath(path),
      method: init.method ?? "GET",
      status: response.status,
      result: response.ok ? "slow" : "failed",
      durationMs,
    }));
  }
  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }
  if (!response.ok) {
    throw new EncoreRequestError(`Encore request failed with ${response.status}`, response.status, payload);
  }
  return payload as T;
}

export async function encoreSessionToken(): Promise<string | undefined> {
  return (await cookies()).get(ENCORE_SESSION_COOKIE)?.value;
}

export async function presaleSessionToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(PRESALE_SESSION_COOKIE)?.value ?? cookieStore.get(ENCORE_SESSION_COOKIE)?.value;
}
