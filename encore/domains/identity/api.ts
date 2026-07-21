// Author: Klaasvaakie ( |╲ )
import { api, APIError } from "encore.dev/api";
import { z } from "zod";
import { auditDb, documentsBucket, identityDb, kycDb, membershipDb, networkDb } from "../../resources";
import { bearerToken, hashSessionToken, sessionFromBearer } from "../auth/access";
import { hashPassword, verifyPassword } from "../auth/password";
import { beginOperation, completeOperation, failOperation, recordStep, requestHash } from "../workflows/core";
import { ensureMembershipPlan } from "../membership/plans";
import { placeMatrixNode } from "../network/placement";

interface RegisterRequest {
  email: string;
  password: string;
  phone?: string;
  profileType: "individual" | "company" | "minor";
  firstName?: string;
  surname?: string;
  companyName?: string;
  companyRegistrationNumber?: string;
  idOrPassportNumber?: string;
  sarsNumber?: string;
  country?: string;
}

interface RegistrationWorkflowRequest extends RegisterRequest {
  membershipPlanCode: string;
  createKyc?: boolean;
  membershipType?: string;
  citizenshipType?: string;
  addressLine?: string;
  city?: string;
  postalCode?: string;
  beneficiaryName?: string;
  beneficiaryId?: string;
  guardianName?: string;
  instapayAccountRef?: string;
  instapayVerifiedAt?: string;
  uplineProfileNumber?: string;
  uplineConfirmed?: boolean;
}

interface RegistrationWorkflowResponse {
  registrationId: string;
  status: string;
  nextAction: "payment" | "retry";
  user: { id: string; email: string; profileId: string; profileNumber: string };
}

const registerRequest = z.object({
  email: z.string().email(),
  password: z.string().min(12).max(128),
  phone: z.string().optional(),
  profileType: z.enum(["individual", "company", "minor"]),
  firstName: z.string().optional(),
  surname: z.string().optional(),
  companyName: z.string().optional(),
  companyRegistrationNumber: z.string().optional(),
  idOrPassportNumber: z.string().optional(),
  sarsNumber: z.string().optional(),
  country: z.string().optional(),
});

const registrationWorkflowRequest = registerRequest.extend({
  membershipPlanCode: z.string().min(3).max(100),
  createKyc: z.boolean().optional(),
  membershipType: z.string().max(100).optional(),
  citizenshipType: z.string().max(100).optional(),
  addressLine: z.string().max(500).optional(),
  city: z.string().max(200).optional(),
  postalCode: z.string().max(30).optional(),
  beneficiaryName: z.string().max(300).optional(),
  beneficiaryId: z.string().max(100).optional(),
  guardianName: z.string().max(300).optional(),
  instapayAccountRef: z.string().max(200).optional(),
  instapayVerifiedAt: z.string().datetime().optional(),
  uplineProfileNumber: z.string().max(100).optional(),
  uplineConfirmed: z.boolean().optional(),
});

const loginRequest = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(128),
});

type LoginResponse = {
  token: string;
  profileId: string;
  profileNumber: string;
};

type FrontendMember = {
  id: string;
  profileNumber: string;
  membershipType: string;
  firstName: string | null;
  lastName: string | null;
  companyName: string | null;
  companyRegNo: string | null;
  idPassport: string | null;
  sarsNumber: string | null;
  email: string;
  country: string;
  mobile: string;
  addressLine: string | null;
  city: string | null;
  postalCode: string | null;
  profilePicture: string | null;
  beneficiaryName: string | null;
  beneficiaryId: string | null;
  guardianName: string | null;
  kycStatus: string;
  kycVerifiedAt: string | null;
  subscriptionStatus: string;
  subscriptionAmount: number;
  subscriptionCurrency: string;
  paymentMethod: string | null;
  taxThreshold: boolean;
  monthlyEarnings: number;
  nfcTagId: string | null;
  visaCardLast4: string | null;
  rootsBankAccount: string | null;
  citizenshipType: string | null;
  instapayStatus: string;
  instapayVerifiedAt: string | null;
  instapayAccountRef: string | null;
  uplineProfileNumber: string | null;
  uplineConfirmed: boolean;
  isAdmin: boolean;
  createdAt: string;
};

export const health = api<void, { ok: boolean; service: string; hardeningRevision: string }>(
  { method: "GET", path: "/health", expose: true },
  async () => {
    return { ok: true, service: "kasihub-backend", hardeningRevision: "performance-redis-v1" };
  },
);

// Durable registration coordinator — Author: Klaasvaakie ( |╲ )
export const startRegistration = api<RegistrationWorkflowRequest, RegistrationWorkflowResponse>(
  { method: "POST", path: "/registration/start", expose: true },
  async (req) => {
    const payload = registrationWorkflowRequest.parse(req);
    const normalizedEmail = payload.email.trim().toLowerCase();
    const payloadHash = requestHash({ ...payload, email: normalizedEmail });
    let workflow = await identityDb.rawQueryRow<{
      id: string; request_hash: string; user_id: string | null; profile_id: string | null; state: string;
    }>("SELECT id, request_hash, user_id, profile_id, state FROM registration_workflows WHERE email = $1", normalizedEmail);
    if (workflow && workflow.request_hash !== payloadHash) {
      throw APIError.alreadyExists("A registration already exists for this email with different details");
    }
    if (!workflow) {
      const workflowId = crypto.randomUUID();
      try {
        await identityDb.rawExec(`INSERT INTO registration_workflows
          (id, email, request_hash, membership_plan_code, create_kyc)
          VALUES ($1, $2, $3, $4, $5)`, workflowId, normalizedEmail, payloadHash, payload.membershipPlanCode, Boolean(payload.createKyc));
      } catch {
        // A concurrent identical request won the unique email constraint.
      }
      workflow = await identityDb.rawQueryRow<{
        id: string; request_hash: string; user_id: string | null; profile_id: string | null; state: string;
      }>("SELECT id, request_hash, user_id, profile_id, state FROM registration_workflows WHERE email = $1", normalizedEmail);
      if (!workflow || workflow.request_hash !== payloadHash) throw APIError.alreadyExists("A registration already exists for this email");
    }

    try {
      if (!workflow.user_id || !workflow.profile_id) {
        const tx = await identityDb.begin();
        try {
          const existingUser = await tx.rawQueryRow<{ id: string }>("SELECT id FROM users WHERE email = $1", normalizedEmail);
          if (existingUser) throw APIError.alreadyExists("An account already exists for this email");
          const userId = crypto.randomUUID();
          const profileId = crypto.randomUUID();
          const profileNumber = `KSI-${crypto.randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase()}`;
          await tx.rawExec("INSERT INTO users (id, email, phone, password_hash) VALUES ($1, $2, $3, $4)",
            userId, normalizedEmail, payload.phone ?? null, hashPassword(payload.password));
          await tx.rawExec(`INSERT INTO profiles (
              id, user_id, profile_type, unique_profile_number, first_name, surname,
              company_name, company_registration_number, id_or_passport_number, sars_number, country, status,
              membership_type, citizenship_type, address_line, city, postal_code, beneficiary_name, beneficiary_id,
              guardian_name, instapay_status, instapay_verified_at, instapay_account_ref, upline_profile_number, upline_confirmed
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'pending',$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)`,
            profileId, userId, payload.profileType, profileNumber, payload.firstName ?? null, payload.surname ?? null,
            payload.companyName ?? null, payload.companyRegistrationNumber ?? null, payload.idOrPassportNumber ?? null,
            payload.sarsNumber ?? null, payload.country ?? "ZA", payload.membershipType ?? null, payload.citizenshipType ?? null,
            payload.addressLine ?? null, payload.city ?? null, payload.postalCode ?? null, payload.beneficiaryName ?? null,
            payload.beneficiaryId ?? null, payload.guardianName ?? null, payload.createKyc ? "PENDING" : "NONE",
            payload.instapayVerifiedAt ?? null, payload.instapayAccountRef ?? null, payload.uplineProfileNumber ?? null,
            Boolean(payload.uplineConfirmed));
          await tx.rawExec(`INSERT INTO user_roles (user_id, role_id)
             SELECT $1, id FROM roles WHERE name = 'member' ON CONFLICT (user_id, role_id) DO NOTHING`, userId);
          await tx.rawExec(`UPDATE registration_workflows SET user_id = $2, profile_id = $3,
             state = 'identity_created', last_error = NULL, updated_at = now() WHERE id = $1`, workflow.id, userId, profileId);
          await tx.commit();
          workflow.user_id = userId;
          workflow.profile_id = profileId;
          workflow.state = "identity_created";
        } catch (error) { await tx.rollback(); throw error; }
      }

      const plan = await membershipDb.rawQueryRow<{ id: string; code: string; amount: string; currency: string }>(
        "SELECT id, code, amount::text AS amount, currency FROM membership_plans WHERE code = $1 AND active = true", payload.membershipPlanCode);
      const materializedPlan = plan ?? await ensureMembershipPlan(payload.membershipPlanCode);
      const subscriptionId = crypto.randomUUID();
      const paymentId = crypto.randomUUID();
      await membershipDb.rawExec(`INSERT INTO subscriptions (id, profile_id, plan_id, status, registration_id, starts_at)
         VALUES ($1, $2, $3, 'pending', $4, now())
         ON CONFLICT (registration_id) WHERE registration_id IS NOT NULL DO NOTHING`,
        subscriptionId, workflow.profile_id, materializedPlan.id, workflow.id);
      const subscription = await membershipDb.rawQueryRow<{ id: string }>("SELECT id FROM subscriptions WHERE registration_id = $1", workflow.id);
      if (!subscription) throw new Error("registration_subscription_not_created");
      await membershipDb.rawExec(`INSERT INTO payments
         (id, profile_id, subscription_id, provider, provider_reference, amount, currency, status, metadata)
         VALUES ($1, $2, $3, 'admin_confirmation', $4, $5::numeric, $6, 'pending', $7::jsonb)
         ON CONFLICT (provider_reference) DO NOTHING`, paymentId, workflow.profile_id, subscription.id,
        `registration-${workflow.id}`, materializedPlan.amount, materializedPlan.currency,
        JSON.stringify({ registrationId: workflow.id, planCode: materializedPlan.code }));
      await identityDb.rawExec("UPDATE registration_workflows SET state = 'membership_pending', last_error = NULL, updated_at = now() WHERE id = $1", workflow.id);

      if (payload.createKyc) {
        await kycDb.rawExec(`INSERT INTO kyc_cases (profile_id, provider, status, registration_id)
           VALUES ($1, 'instapay', 'pending', $2)
           ON CONFLICT (registration_id) WHERE registration_id IS NOT NULL DO NOTHING`, workflow.profile_id, workflow.id);
        await identityDb.rawExec("UPDATE registration_workflows SET state = 'kyc_pending', updated_at = now() WHERE id = $1", workflow.id);
      }

      await identityDb.rawExec(`UPDATE registration_workflows SET state = 'completed', last_error = NULL,
         completed_at = now(), updated_at = now() WHERE id = $1`, workflow.id);
      const profile = await identityDb.rawQueryRow<{ unique_profile_number: string }>("SELECT unique_profile_number FROM profiles WHERE id = $1", workflow.profile_id);
      if (!profile || !workflow.user_id || !workflow.profile_id) throw new Error("registration_identity_not_found");
      return {
        registrationId: workflow.id,
        status: "awaiting_payment",
        nextAction: "payment",
        user: { id: workflow.user_id, email: normalizedEmail, profileId: workflow.profile_id, profileNumber: profile.unique_profile_number },
      };
    } catch (error) {
      await identityDb.rawExec(`UPDATE registration_workflows SET state = 'failed', last_error = $2,
         retry_count = retry_count + 1, updated_at = now() WHERE id = $1`, workflow.id,
        (error instanceof Error ? error.message : String(error)).slice(0, 1000));
      throw error;
    }
  },
);

export const login = api<{ email: string; password: string }, LoginResponse>(
  { method: "POST", path: "/auth/login", expose: true },
  async (req) => {
    const payload = loginRequest.parse(req);
    const user = await identityDb.rawQueryRow<{ id: string; email: string; password_hash: string | null }>("SELECT id, email, password_hash FROM users WHERE email = $1",
      payload.email,
    );
    if (!user?.password_hash || !verifyPassword(payload.password, user.password_hash)) {
      throw APIError.unauthenticated("Invalid email or password");
    }
    const profile = await identityDb.rawQueryRow<{ id: string; unique_profile_number: string }>("SELECT id, unique_profile_number FROM profiles WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1",
      user.id,
    );
    if (!profile) {
      throw APIError.notFound("Member profile not found");
    }
    const token = crypto.randomUUID();
    await identityDb.rawExec(`INSERT INTO sessions (user_id, token, created_at, expires_at)
       VALUES ($1, $2, now(), now() + interval '7 days')`,
      user.id,
      hashSessionToken(token),
    );
    return {
      token,
      profileId: profile.id,
      profileNumber: profile.unique_profile_number,
    };
  },
);

export const me = api<void, { user: { id: string; email: string; profileId: string; profileNumber: string } | null }>(
  { method: "GET", path: "/auth/me", expose: true },
  async () => {
    const session = await sessionFromBearer();
    if (!session) return { user: null };
    return {
      user: {
        id: session.user.id,
        email: session.user.email,
        profileId: session.profile.id,
        profileNumber: session.profile.unique_profile_number,
      },
    };
  },
);

export const myProfile = api<void, { member: FrontendMember }>(
  { method: "GET", path: "/profiles/me", expose: true },
  async () => {
    const session = await sessionFromBearer();
    if (!session) throw APIError.unauthenticated("Authentication is required");
    const profile = await identityDb.rawQueryRow<{
      id: string;
      unique_profile_number: string;
      profile_type: string;
      first_name: string | null;
      surname: string | null;
      company_name: string | null;
      company_registration_number: string | null;
      id_or_passport_number: string | null;
      sars_number: string | null;
      country: string | null;
      profile_picture_url: string | null;
      status: string;
      phone: string | null;
      created_at: string;
      membership_type: string | null; citizenship_type: string | null; address_line: string | null; city: string | null;
      postal_code: string | null; beneficiary_name: string | null; beneficiary_id: string | null; guardian_name: string | null;
      kyc_verified_at: string | null; tax_threshold: boolean; monthly_earnings: string; nfc_tag_id: string | null;
      visa_card_last4: string | null; roots_bank_account: string | null; instapay_status: string;
      instapay_verified_at: string | null; instapay_account_ref: string | null; upline_profile_number: string | null; upline_confirmed: boolean;
    }>(
      `SELECT p.id, p.unique_profile_number, p.profile_type, p.first_name, p.surname,
              p.company_name, p.company_registration_number, p.id_or_passport_number,
              p.sars_number, p.country, p.profile_picture_url, p.status, u.phone, p.created_at,
              p.membership_type, p.citizenship_type, p.address_line, p.city, p.postal_code,
              p.beneficiary_name, p.beneficiary_id, p.guardian_name, p.kyc_verified_at,
              p.tax_threshold, p.monthly_earnings::text AS monthly_earnings, p.nfc_tag_id,
              p.visa_card_last4, p.roots_bank_account, p.instapay_status, p.instapay_verified_at,
              p.instapay_account_ref, p.upline_profile_number, p.upline_confirmed
       FROM profiles p
       JOIN users u ON u.id = p.user_id
       WHERE p.id = $1`,
      session.profile.id,
    );
    if (!profile) throw APIError.notFound("Member profile not found");
    const subscription = await membershipDb.rawQueryRow<{
      status: string;
      amount: string;
      currency: string;
      provider: string | null;
    }>(
      `SELECT s.status, mp.amount::text AS amount, mp.currency,
              (SELECT provider FROM payments WHERE profile_id = s.profile_id ORDER BY created_at DESC LIMIT 1) AS provider
       FROM subscriptions s
       JOIN membership_plans mp ON mp.id = s.plan_id
       WHERE s.profile_id = $1
       ORDER BY s.starts_at DESC LIMIT 1`,
      profile.id,
    );
    const adminRole = await identityDb.rawQueryRow<{ name: string }>(
      `SELECT r.name FROM user_roles ur
       JOIN roles r ON r.id = ur.role_id
       WHERE ur.user_id = $1 AND r.name = 'admin' LIMIT 1`,
      session.user.id,
    );
    return {
      member: {
        id: profile.id,
        profileNumber: profile.unique_profile_number,
        membershipType: profile.membership_type ?? profile.profile_type.toUpperCase(),
        firstName: profile.first_name,
        lastName: profile.surname,
        companyName: profile.company_name,
        companyRegNo: profile.company_registration_number,
        idPassport: profile.id_or_passport_number,
        sarsNumber: profile.sars_number,
        email: session.user.email,
        country: profile.country ?? "ZA",
        mobile: profile.phone ?? "",
        addressLine: profile.address_line,
        city: profile.city,
        postalCode: profile.postal_code,
        profilePicture: profile.profile_picture_url,
        beneficiaryName: profile.beneficiary_name,
        beneficiaryId: profile.beneficiary_id,
        guardianName: profile.guardian_name,
        kycStatus: profile.status === "active" ? "VERIFIED" : "PENDING",
        kycVerifiedAt: profile.kyc_verified_at,
        subscriptionStatus: subscription?.status.toUpperCase() ?? "PENDING",
        subscriptionAmount: Number(subscription?.amount ?? 0),
        subscriptionCurrency: subscription?.currency ?? "ZAR",
        paymentMethod: subscription?.provider?.toUpperCase() ?? null,
        taxThreshold: profile.tax_threshold,
        monthlyEarnings: Number(profile.monthly_earnings),
        nfcTagId: profile.nfc_tag_id,
        visaCardLast4: profile.visa_card_last4,
        rootsBankAccount: profile.roots_bank_account,
        citizenshipType: profile.citizenship_type,
        instapayStatus: profile.instapay_status,
        instapayVerifiedAt: profile.instapay_verified_at,
        instapayAccountRef: profile.instapay_account_ref,
        uplineProfileNumber: profile.upline_profile_number,
        uplineConfirmed: profile.upline_confirmed,
        isAdmin: Boolean(adminRole),
        createdAt: profile.created_at,
      },
    };
  },
);

export const logout = api<void, { ok: true }>(
  { method: "POST", path: "/auth/logout", expose: true },
  async () => {
    const token = bearerToken();
    if (token) {
      await identityDb.rawExec(`UPDATE sessions SET revoked_at = now() WHERE token = $1`, hashSessionToken(token));
    }
    return { ok: true };
  },
);
