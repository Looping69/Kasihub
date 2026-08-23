// Author: Klaasvaakie ( |╲ )
export const PRESALE_INVESTOR_ROLE = "presale_investor";

export function hasEcosystemRole(roles: Iterable<string>): boolean {
  for (const role of roles) {
    if (role === "member" || role === "admin") return true;
  }
  return false;
}
