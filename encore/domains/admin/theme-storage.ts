// Author: Klaasvaakie ( |╲ )
export function decodeStoredConfig(value: unknown): Record<string, unknown> | null {
  let decoded = value;
  if (typeof decoded === "string") {
    try { decoded = JSON.parse(decoded) as unknown; }
    catch { return null; }
  }
  return decoded && typeof decoded === "object" && !Array.isArray(decoded)
    ? decoded as Record<string, unknown>
    : null;
}
