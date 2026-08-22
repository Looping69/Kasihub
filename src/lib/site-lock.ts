// Author: Klaasvaakie ( |╲ )
export const SITE_LOCK_COOKIE = "kasihub_site_unlock";

export function siteLockEnabled(): boolean {
  return Boolean(process.env.SITE_LOCK_PIN && process.env.SITE_LOCK_SECRET);
}

export async function siteLockToken(): Promise<string | null> {
  const secret = process.env.SITE_LOCK_SECRET;
  if (!secret) return null;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode("kasihub-temporary-site-lock-v1"));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function safeReturnPath(value: string | null): string {
  return value?.startsWith("/") && !value.startsWith("//") && !value.startsWith("/site-lock") ? value : "/";
}
