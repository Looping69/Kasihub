// Author: Klaasvaakie ( |╲ )
export const TESTER_ADMIN_EMAIL = "platform.admin.20260722@kasihub.co.za";

export function hasTesterAdminAccess(
  email: string,
  environmentType: "production" | "development" | "ephemeral" | "test",
): boolean {
  return environmentType !== "production"
    && email.trim().toLowerCase() === TESTER_ADMIN_EMAIL;
}
