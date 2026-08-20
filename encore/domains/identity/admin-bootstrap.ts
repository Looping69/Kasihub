// Author: Klaasvaakie ( |╲ )
import { secret } from "encore.dev/config";
import { api, APIError } from "encore.dev/api";
import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { identityDb } from "../../resources";
import { requestHeader } from "../auth/access";
import { hashPassword } from "../auth/password";

const AdminBootstrapSecret = secret("AdminBootstrapSecret");

interface AdminBootstrapRequest {
  email: string;
  password: string;
  firstName: string;
  surname: string;
}

interface AdminBootstrapResponse {
  created: true;
  userId: string;
  profileId: string;
  profileNumber: string;
}

const adminBootstrapRequest = z.object({
  email: z.string().email().max(320),
  password: z.string().min(20).max(128)
    .regex(/[a-z]/, "Password must contain a lowercase letter")
    .regex(/[A-Z]/, "Password must contain an uppercase letter")
    .regex(/[0-9]/, "Password must contain a number")
    .regex(/[^A-Za-z0-9]/, "Password must contain a symbol"),
  firstName: z.string().trim().min(1).max(100),
  surname: z.string().trim().min(1).max(100),
});

function secretMatches(candidate: string, expected: string): boolean {
  const candidateDigest = createHash("sha256").update(candidate).digest();
  const expectedDigest = createHash("sha256").update(expected).digest();
  return timingSafeEqual(candidateDigest, expectedDigest);
}

/**
 * Creates the first database-backed administrator exactly once.
 *
 * The high-entropy bootstrap secret is supplied only as a request header. An
 * advisory transaction lock prevents concurrent requests from creating two
 * administrators. Once an admin or bootstrap event exists, the path remains
 * permanently locked without a database migration and explicit recovery.
 */
export const bootstrapFirstAdmin = api<AdminBootstrapRequest, AdminBootstrapResponse>(
  { method: "POST", path: "/identity/admin/bootstrap", expose: true },
  async (req) => {
    const suppliedSecret = requestHeader("x-admin-bootstrap-secret");
    if (!suppliedSecret || !secretMatches(suppliedSecret, AdminBootstrapSecret())) {
      throw APIError.unauthenticated("Bootstrap authorization failed");
    }

    const payload = adminBootstrapRequest.parse(req);
    const normalizedEmail = payload.email.trim().toLowerCase();
    const tx = await identityDb.begin();
    try {
      await tx.rawExec("SELECT pg_advisory_xact_lock(1262562631)");
      const existingAdmin = await tx.rawQueryRow<{ exists: boolean }>(
        `SELECT EXISTS (
           SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
           WHERE r.name = 'admin'
         ) AS exists`,
      );
      const bootstrapEvent = await tx.rawQueryRow<{ exists: boolean }>(
        "SELECT EXISTS (SELECT 1 FROM admin_bootstrap_events) AS exists",
      );
      if (existingAdmin?.exists || bootstrapEvent?.exists) {
        throw APIError.failedPrecondition("Administrator bootstrap is permanently locked");
      }

      const existingUser = await tx.rawQueryRow<{ id: string }>(
        "SELECT id FROM users WHERE lower(email) = $1",
        normalizedEmail,
      );
      if (existingUser) throw APIError.alreadyExists("An account already exists for this email");

      const userId = crypto.randomUUID();
      const profileId = crypto.randomUUID();
      const profileNumber = `KSI-ADMIN-${crypto.randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase()}`;
      await tx.rawExec(
        "INSERT INTO users (id, email, password_hash, status) VALUES ($1, $2, $3, 'active')",
        userId,
        normalizedEmail,
        hashPassword(payload.password),
      );
      await tx.rawExec(
        `INSERT INTO profiles
          (id, user_id, profile_type, unique_profile_number, first_name, surname, country, status,
           membership_type, citizenship_type, onboarding_authority, upline_confirmed)
         VALUES ($1, $2, 'individual', $3, $4, $5, 'ZA', 'active',
                 'INDIVIDUAL', 'SA_CITIZEN_SA', 'kasihub', false)`,
        profileId,
        userId,
        profileNumber,
        payload.firstName,
        payload.surname,
      );
      await tx.rawExec(
        `INSERT INTO user_roles (user_id, role_id)
         SELECT $1, id FROM roles WHERE name IN ('member', 'admin')
         ON CONFLICT (user_id, role_id) DO NOTHING`,
        userId,
      );
      const assignedAdmin = await tx.rawQueryRow<{ exists: boolean }>(
        `SELECT EXISTS (
           SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
           WHERE ur.user_id = $1 AND r.name = 'admin'
         ) AS exists`,
        userId,
      );
      if (!assignedAdmin?.exists) throw new Error("admin_role_not_seeded");

      await tx.rawExec(
        "INSERT INTO admin_bootstrap_events (singleton, user_id, email) VALUES (true, $1, $2)",
        userId,
        normalizedEmail,
      );
      await tx.commit();
      return { created: true, userId, profileId, profileNumber };
    } catch (error) {
      await tx.rollback();
      throw error;
    }
  },
);

