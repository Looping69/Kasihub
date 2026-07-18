// Author: Klaasvaakie ( |╲ )
import "server-only";
import { cookies } from "next/headers";

export const ENCORE_SESSION_COOKIE = "kasihub_session";

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
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });
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
