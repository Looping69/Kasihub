// Author: Klaasvaakie ( |╲ )
import { appMeta, currentRequest } from "encore.dev";
import { APIError } from "encore.dev/api";
import { createHash } from "node:crypto";
import { identityDb } from "../../resources";
import { hasEcosystemRole } from "./role-policy";
import { hasTesterAdminAccess } from "./tester-access";

export interface AuthenticatedSession {
  token: string;
  scope: "ecosystem" | "presale";
  user: { id: string; email: string };
  profile: { id: string; unique_profile_number: string };
}

function headerValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export function requestHeader(name: string): string {
  const request = currentRequest();
  if (!request || !("headers" in request)) return "";
  return headerValue(request.headers?.[name.toLowerCase()]);
}

export function bearerToken(): string {
  const auth = requestHeader("authorization");
  return auth.startsWith("Bearer ") ? auth.slice(7) : "";
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function sessionFromBearer(): Promise<AuthenticatedSession | null> {
  const token = bearerToken();
  if (!token) return null;
  const row = await identityDb.rawQueryRow<{
    token: string;
    user_id: string;
    email: string;
    profile_id: string;
    unique_profile_number: string;
    session_scope: "ecosystem" | "presale";
  }>(`SELECT s.token, s.session_scope, u.id AS user_id, u.email, p.id AS profile_id, p.unique_profile_number
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     JOIN profiles p ON p.user_id = u.id
     WHERE s.token = $1 AND s.revoked_at IS NULL AND s.expires_at > now()
     ORDER BY p.created_at DESC LIMIT 1`, hashSessionToken(token));
  if (!row) return null;
  return {
    token: row.token,
    scope: row.session_scope,
    user: { id: row.user_id, email: row.email },
    profile: { id: row.profile_id, unique_profile_number: row.unique_profile_number },
  };
}

export async function requireSession(): Promise<AuthenticatedSession> {
  const session = await sessionFromBearer();
  if (!session) throw APIError.unauthenticated("Authentication is required");
  return session;
}

export async function requireAdminAccess(): Promise<AuthenticatedSession> {
  const session = await requireSession();
  if (hasTesterAdminAccess(session.user.email, appMeta().environment.type)) return session;
  const role = await identityDb.rawQueryRow<{ name: string }>(
    `SELECT r.name FROM user_roles ur
     JOIN roles r ON r.id = ur.role_id
     WHERE ur.user_id = $1 AND r.name = 'admin' LIMIT 1`,
    session.user.id,
  );
  if (!role) throw APIError.permissionDenied("Administrator access is required");
  return session;
}

export async function requireProfileAccess(profileId: string): Promise<AuthenticatedSession> {
  const session = await requireSession();
  if (session.profile.id === profileId) return session;
  if (hasTesterAdminAccess(session.user.email, appMeta().environment.type)) return session;
  const role = await identityDb.rawQueryRow<{ name: string }>(
    `SELECT r.name FROM user_roles ur
     JOIN roles r ON r.id = ur.role_id
     WHERE ur.user_id = $1 AND r.name = 'admin' LIMIT 1`,
    session.user.id,
  );
  if (!role) throw APIError.permissionDenied("Profile access is not permitted");
  return session;
}

export async function requirePresaleSession(): Promise<AuthenticatedSession> {
  const session = await requireSession();
  if (session.scope !== "presale") throw APIError.permissionDenied("KaSiShares applicant access is required");
  const role = await identityDb.rawQueryRow<{ name: string }>(
    `SELECT r.name FROM user_roles ur
     JOIN roles r ON r.id = ur.role_id
     WHERE ur.user_id = $1 AND r.name = 'presale_investor' LIMIT 1`,
    session.user.id,
  );
  if (!role) throw APIError.permissionDenied("KaSiShares applicant access is required");
  return session;
}

export async function requireEcosystemProfileAccess(profileId: string): Promise<AuthenticatedSession> {
  const session = await requireProfileAccess(profileId);
  if (hasTesterAdminAccess(session.user.email, appMeta().environment.type)) return session;
  const roles = await identityDb.rawQueryAll<{ name: string }>(
    `SELECT r.name FROM user_roles ur
     JOIN roles r ON r.id = ur.role_id
     WHERE ur.user_id = $1 AND r.name IN ('member', 'admin')`,
    session.user.id,
  );
  if (!hasEcosystemRole(roles.map((role) => role.name))) {
    throw APIError.permissionDenied("Ecosystem membership is required");
  }
  return session;
}
