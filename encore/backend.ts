// Author: Klaasvaakie ( |â•² )
import { api, APIError } from "encore.dev/api";
import { CronJob } from "encore.dev/cron";
import { z } from "zod";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import {
  auditDb,
  commerceDb,
  documentsBucket,
  engagementDb,
  financeDb,
  identityDb,
  kycDb,
  membershipDb,
  networkDb,
  sharesDb,
} from "./resources";
import {
  bearerToken,
  hashSessionToken,
  requireAdminAccess,
  requireProfileAccess,
  sessionFromBearer,
} from "./domains/auth/access";
import { hashPassword, verifyPassword } from "./domains/auth/password";
import {
  beginOperation,
  captureWalletHold,
  completeOperation,
  creditDistribution as creditWorkflowDistribution,
  ensureAuthoritativeWallet,
  failOperation,
  placeWalletHold,
  recordStep,
  releaseWalletHold,
  requireIdempotencyKey,
  requestHash,
} from "./domains/workflows/core";
import "./domains/admin/operations";
import { allocateEvenCents, allocateWeightedCents } from "./domains/finance/allocation";
import { ensureMembershipPlan } from "./domains/membership/plans";
import { placeMatrixNode } from "./domains/network/placement";
import { ensureLedgerAccount as ensureDomainLedgerAccount } from "./domains/wallets/ledger";

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

const ledgerEntry = z.object({
  direction: z.enum(["debit", "credit"]),
  amount: z.number().positive(),
});

const loginRequest = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(128),
});

interface ConfigVersionRequest {
  config: Record<string, unknown>;
}

interface KycCaseCreateRequest {
  profileId: string;
  provider: string;
}

interface KycCaseResponse {
  id: string;
  profileId: string;
  provider: string;
  status: string;
}

interface SubscribeRequest {
  profileId: string;
  planCode: string;
}

interface SubscribeResponse {
  subscriptionId: string;
  paymentId: string;
  status: string;
  operationId?: string;
}

interface MatrixNodeResponse {
  id: string;
  profileId: string;
  parentNodeId: string | null;
  sponsorProfileId: string | null;
  positionIndex: number;
  depth: number;
  path: string;
}

interface MatrixTreeNode {
  profileId: string;
  parentNodeId: string | null;
  sponsorProfileId: string | null;
  positionIndex: number;
  depth: number;
  path: string;
}

interface SharePurchaseRequest {
  profileId: string;
  phaseNumber: number;
  quantity: number;
}

interface SharePhaseResponse {
  id: string;
  phaseNumber: number;
  quantityAvailable: number;
  pricePerShare: string;
  currency: string;
  status: string;
  totalShares?: number;
  bonusBuyOneGet?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface SharePurchaseResponse {
  purchaseId: string;
  status: string;
  totalAmount: string;
  bonusQuantity: number;
  certificateNumber: string;
  operationId: string;
}

const configVersion = z.object({
  config: z.record(z.string(), z.unknown()),
});

const kycRequest = z.object({
  provider: z.string().min(1),
});

const subscribeRequest = z.object({
  profileId: z.string().min(1),
  planCode: z.string().min(1),
});

const sharePurchaseRequest = z.object({
  profileId: z.string().min(1),
  phaseNumber: z.number().int().positive(),
  quantity: z.number().int().positive(),
});

type RegisterResponse = {
  user: {
    id: string;
    email: string;
    profileId: string;
    profileNumber: string;
  };
};

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
    return { ok: true, service: "kasihub-backend", hardeningRevision: "financial-workflows-v1" };
  },
);

export const register = api<RegisterRequest, RegisterResponse>(
  { method: "POST", path: "/auth/register", expose: true },
  async (req) => {
    const payload = registerRequest.parse(req);
    const userId = crypto.randomUUID();
    const profileId = crypto.randomUUID();
    const profileNumber = `KSI-${String(Date.now()).slice(-8)}`;

    await identityDb.rawExec(`INSERT INTO users (id, email, phone, password_hash) VALUES ($1, $2, $3, $4)`,
      userId,
      payload.email,
      payload.phone ?? null,
      hashPassword(payload.password),
    );
    await identityDb.rawExec(`INSERT INTO profiles (
        id, user_id, profile_type, unique_profile_number, first_name, surname,
        company_name, company_registration_number, id_or_passport_number, sars_number, country, status
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      profileId,
      userId,
      payload.profileType,
      profileNumber,
      payload.firstName ?? null,
      payload.surname ?? null,
      payload.companyName ?? null,
      payload.companyRegistrationNumber ?? null,
      payload.idOrPassportNumber ?? null,
      payload.sarsNumber ?? null,
      payload.country ?? "ZA",
      "pending",
    );
    await identityDb.rawExec(
      `INSERT INTO user_roles (user_id, role_id)
       SELECT $1, id FROM roles WHERE name = 'member'
       ON CONFLICT (user_id, role_id) DO NOTHING`,
      userId,
    );
    return {
      user: {
        id: userId,
        email: payload.email,
        profileId,
        profileNumber,
      },
    };
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
      throw new Error("unauthenticated");
    }
    const profile = await identityDb.rawQueryRow<{ id: string; unique_profile_number: string }>("SELECT id, unique_profile_number FROM profiles WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1",
      user.id,
    );
    if (!profile) {
      throw new Error("not_found");
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
    if (!session) throw new Error("unauthenticated");
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
    if (!profile) throw new Error("not_found");
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

export const membershipPlans = api<
  void,
  {
    plans: {
      id: string;
      code: string;
      name: string;
      active: boolean;
      amount: string;
      currency: string;
    }[];
  }
>(
  { method: "GET", path: "/membership/plans", expose: true },
  async () => {
    const rows = await membershipDb.rawQueryAll<{
      id: string;
      code: string;
      name: string;
      active: boolean;
      amount: string;
      currency: string;
    }>("SELECT id, code, name, active, amount::text AS amount, currency FROM membership_plans WHERE active = true ORDER BY code");
    if (rows.length === 0) {
      const defaults = [
        { code: "INDIVIDUAL_LOCAL", name: "Individual Local", currency: "ZAR", amount: "140.00" },
        { code: "INDIVIDUAL_INTERNATIONAL", name: "Individual International", currency: "USD", amount: "20.00" },
        { code: "COMPANY_LOCAL", name: "Company Local", currency: "ZAR", amount: "300.00" },
        { code: "COMPANY_INTERNATIONAL", name: "Company International", currency: "USD", amount: "50.00" },
      ];
      for (const plan of defaults) {
        await membershipDb.rawExec(`INSERT INTO membership_plans (code, name, member_type, currency, amount, billing_period, active)
           VALUES ($1, $2, $3, $4, $5::numeric, 'monthly', true)
           ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, currency = EXCLUDED.currency, amount = EXCLUDED.amount, active = true`,
          plan.code,
          plan.name,
          plan.code.includes("COMPANY") ? "company" : "individual",
          plan.currency,
          plan.amount,
        );
      }
      return {
        plans: await membershipDb.rawQueryAll<{
          id: string;
          code: string;
          name: string;
          active: boolean;
          amount: string;
          currency: string;
        }>("SELECT id, code, name, active, amount::text AS amount, currency FROM membership_plans WHERE active = true ORDER BY code"),
      };
    }
    return {
      plans: rows,
    };
  },
);

export const validateLedger = api<{ entries: unknown[] }, { balanced: boolean }>(
  { method: "POST", path: "/ledger/validate", expose: true },
  async (req) => {
    const entries = z.array(ledgerEntry).parse(req.entries);
    const total = entries.reduce((sum, entry) => {
      return entry.direction === "credit" ? sum + entry.amount : sum - entry.amount;
    }, 0);
    return { balanced: Math.abs(total) < 0.000001 };
  },
);

export const walletMe = api<
  { profileId: string },
  {
    balance: string;
    currency: string;
    transactions: { id: string; type: string; amount: number; description: string; status: string; createdAt: string }[];
  }
>(
  { method: "GET", path: "/wallets/me/:profileId", expose: true },
  async (req) => {
    await requireProfileAccess(req.profileId);
    const legacyWallet = await networkDb.rawQueryRow<{ currency: string }>(
      "SELECT currency FROM wallets WHERE profile_id = $1 ORDER BY created_at DESC LIMIT 1", req.profileId);
    await ensureAuthoritativeWallet(req.profileId, legacyWallet?.currency ?? "ZAR");
    const wallet = await financeDb.rawQueryRow<{ available_balance: string; currency: string }>(
      "SELECT available_balance::text AS available_balance, currency FROM wallet_balances WHERE profile_id = $1 AND currency = $2",
      req.profileId, legacyWallet?.currency ?? "ZAR");
    const transactions = await financeDb.rawQueryAll<{
      id: string;
      transaction_type: string;
      description: string;
      amount: string;
      created_at: string;
    }>(
      `SELECT lt.id, lt.transaction_type, lt.description, lt.created_at,
              COALESCE(SUM(CASE WHEN le.direction = 'credit' THEN le.amount ELSE -le.amount END), 0)::text AS amount
       FROM ledger_transactions lt
       JOIN ledger_entries le ON le.transaction_id = lt.id
       JOIN ledger_accounts la ON la.id = le.account_id
       WHERE la.owner_type = 'profile' AND la.owner_id = $1
       GROUP BY lt.id, lt.transaction_type, lt.description, lt.created_at
       ORDER BY lt.created_at DESC
       LIMIT 100`,
      req.profileId,
    );
    return {
      balance: wallet?.available_balance ?? "0.00",
      currency: wallet?.currency ?? "ZAR",
      transactions: transactions.map((transaction) => ({
        id: transaction.id,
        type: transaction.transaction_type.toUpperCase(),
        amount: Number(transaction.amount),
        description: transaction.description,
        status: "COMPLETED",
        createdAt: transaction.created_at,
      })),
    };
  },
);

export const subscribeMembership = api<SubscribeRequest, SubscribeResponse>(
  { method: "POST", path: "/membership/subscribe", expose: true },
  async (req) => {
    const payload = subscribeRequest.parse(req);
    const session = await requireProfileAccess(payload.profileId);
    const idempotencyKey = requireIdempotencyKey();
    const started = await beginOperation<SubscribeResponse>({
      operationType: "membership_subscription", actorUserId: session.user.id,
      profileId: payload.profileId, idempotencyKey, payload,
    });
    if (started.operation.state === "completed" && started.operation.result) return started.operation.result;
    const operation = started.operation;
    const plan = await membershipDb.rawQueryRow<{
      id: string;
      code: string;
      amount: string;
      currency: string;
    }>("SELECT id, code, amount::text AS amount, currency FROM membership_plans WHERE code = $1 AND active = true", payload.planCode);
    const materializedPlan = plan ?? (await ensureMembershipPlan(payload.planCode));

    try {
      let subscription = await membershipDb.rawQueryRow<{ id: string }>("SELECT id FROM subscriptions WHERE operation_id = $1", operation.id);
      if (!subscription) {
        subscription = await membershipDb.rawQueryRow(`INSERT INTO subscriptions (id, profile_id, plan_id, status, operation_id, starts_at)
          VALUES ($1, $2, $3, 'pending', $4, now()) RETURNING id`,
          crypto.randomUUID(), payload.profileId, materializedPlan.id, operation.id);
      }
      if (!subscription) throw new Error("subscription_not_created");
      const paymentRef = `subscription-${operation.id}`;
      await membershipDb.rawExec(`INSERT INTO payments (id, profile_id, subscription_id, provider, provider_reference, amount, currency, status, metadata)
         VALUES ($1, $2, $3, 'admin_confirmation', $4, $5::numeric, $6, 'pending', $7::jsonb)
         ON CONFLICT (provider_reference) DO NOTHING`,
        crypto.randomUUID(), payload.profileId, subscription.id, paymentRef, materializedPlan.amount, materializedPlan.currency,
        JSON.stringify({ planCode: materializedPlan.code, operationId: operation.id }));
      const payment = await membershipDb.rawQueryRow<{ id: string }>("SELECT id FROM payments WHERE provider_reference = $1", paymentRef);
      if (!payment) throw new Error("subscription_payment_not_created");
      await recordStep(operation, "create_pending_subscription", "completed", { subscriptionId: subscription.id, paymentId: payment.id });
      return completeOperation(operation, { subscriptionId: subscription.id, paymentId: payment.id, status: "pending", operationId: operation.id });
    } catch (error) { return failOperation(operation, error); }
  },
);

export const membershipSubscription = api<
  { profileId: string; subscriptionId?: string },
  { subscription: { id: string; amount: number; currency: string; method: string; status: string; period: string; createdAt: string } | null }
>(
  { method: "GET", path: "/membership/subscriptions/:profileId", expose: true },
  async (req) => {
    await requireProfileAccess(req.profileId);
    const row = await membershipDb.rawQueryRow<{
      id: string; amount: string; currency: string; provider: string | null; status: string; starts_at: string;
    }>(
      `SELECT s.id, mp.amount::text AS amount, mp.currency,
              (SELECT provider FROM payments WHERE subscription_id = s.id ORDER BY created_at DESC LIMIT 1) AS provider,
              s.status, s.starts_at
       FROM subscriptions s JOIN membership_plans mp ON mp.id = s.plan_id
       WHERE s.profile_id = $1 AND ($2::uuid IS NULL OR s.id = $2::uuid)
       ORDER BY s.starts_at DESC LIMIT 1`,
      req.profileId, req.subscriptionId ?? null,
    );
    return { subscription: row ? { id: row.id, amount: Number(row.amount), currency: row.currency, method: row.provider?.toUpperCase() ?? "PENDING", status: row.status.toUpperCase(), period: row.starts_at.slice(0, 7), createdAt: row.starts_at } : null };
  },
);

export const activateSubscription = api<
  { paymentId: string },
  {
    ok: true;
    operationId: string;
    status: string;
    wallet: { profile_id: string; currency: string; cached_balance: string } | null;
    matrixNode: MatrixNodeResponse | null;
  }
>(
  { method: "POST", path: "/payments/activate", expose: true },
  async (req) => {
    const admin = await requireAdminAccess();
    const idempotencyKey = requireIdempotencyKey();
    const payment = await membershipDb.rawQueryRow<{
      id: string;
      profile_id: string;
      subscription_id: string | null;
      amount: string;
      currency: string;
    }>("SELECT id, profile_id, subscription_id, amount::text AS amount, currency FROM payments WHERE id = $1", req.paymentId);
    if (!payment || !payment.subscription_id) {
      throw new Error("payment_not_found");
    }
    const started = await beginOperation<{
      ok: true; operationId: string; status: string;
      wallet: { profile_id: string; currency: string; cached_balance: string } | null;
      matrixNode: MatrixNodeResponse | null;
    }>({ operationType: "subscription_activation", actorUserId: admin.user.id, profileId: payment.profile_id, idempotencyKey, payload: req });
    if (started.operation.state === "completed" && started.operation.result) return started.operation.result;
    const operation = started.operation;
    try {
      const membershipTx = await membershipDb.begin();
      try {
        await membershipTx.rawExec("UPDATE payments SET status = 'paid' WHERE id = $1 AND status <> 'paid'", req.paymentId);
        await membershipTx.rawExec("UPDATE subscriptions SET status = 'active' WHERE id = $1", payment.subscription_id);
        await membershipTx.commit();
      } catch (error) { await membershipTx.rollback(); throw error; }
      await recordStep(operation, "activate_membership", "completed", { paymentId: payment.id, subscriptionId: payment.subscription_id });

      const existingLedger = await financeDb.rawQueryRow<{ id: string }>(
        "SELECT id FROM ledger_transactions WHERE reference_type = 'payment' AND reference_id = $1 LIMIT 1", payment.id);
      if (!existingLedger) {
        const cashAccountId = await ensureDomainLedgerAccount("system", "00000000-0000-0000-0000-000000000000", "cash", payment.currency);
        const revenueAccountId = await ensureDomainLedgerAccount("profile", payment.profile_id, "membership_revenue", payment.currency);
        const ledgerTransactionId = crypto.randomUUID();
        const tx = await financeDb.begin();
        try {
          await tx.rawExec(`INSERT INTO ledger_transactions (id, transaction_type, reference_type, reference_id, description, created_by)
             VALUES ($1, 'membership_payment', 'payment', $2, 'Administrator-confirmed membership payment', $3)`,
            ledgerTransactionId, payment.id, admin.user.id);
          await tx.rawExec(`INSERT INTO ledger_entries (transaction_id, account_id, direction, amount, currency)
             VALUES ($1, $2, 'debit', $3::numeric, $4), ($1, $5, 'credit', $3::numeric, $4)`,
            ledgerTransactionId, cashAccountId, payment.amount, payment.currency, revenueAccountId);
          await tx.commit();
        } catch (error) { await tx.rollback(); throw error; }
      }
      await recordStep(operation, "record_membership_payment", "completed", { paymentId: payment.id, amount: payment.amount, currency: payment.currency });

      const profilePlacement = await identityDb.rawQueryRow<{ upline_profile_number: string | null }>(
        "SELECT upline_profile_number FROM profiles WHERE id = $1", payment.profile_id);
      const sponsor = profilePlacement?.upline_profile_number
        ? await identityDb.rawQueryRow<{ id: string }>("SELECT id FROM profiles WHERE unique_profile_number = $1", profilePlacement.upline_profile_number)
        : null;
      const node = await placeMatrixNode(payment.profile_id, sponsor?.id ?? null);
      await recordStep(operation, "place_network_node", "completed", { nodeId: node.id, path: node.path });
      const priorAudit = await auditDb.rawQueryRow<{ id: string }>(
        "SELECT id FROM audit_logs WHERE action = 'payments.activate' AND entity_id = $1 LIMIT 1", payment.id);
      if (!priorAudit) {
        await auditDb.rawExec(`INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, after)
           VALUES ($1, 'payments.activate', 'payments', $2, $3::jsonb)`,
          admin.user.id, payment.id, JSON.stringify({ operationId: operation.id, profileId: payment.profile_id, subscriptionId: payment.subscription_id, amount: payment.amount, currency: payment.currency }));
      }
      const wallet = await networkDb.rawQueryRow<{ profile_id: string; currency: string; cached_balance: string }>(
        "SELECT profile_id, currency, cached_balance::text AS cached_balance FROM wallets WHERE profile_id = $1", payment.profile_id);
      return completeOperation(operation, { ok: true, operationId: operation.id, status: "completed", wallet, matrixNode: node });
    } catch (error) {
      return failOperation(operation, error);
    }
  },
);

export const myMatrix = api<
  { profileId: string },
  { node: MatrixNodeResponse | null }
>(
  { method: "GET", path: "/matrix/me/:profileId", expose: true },
  async (req) => {
    await requireProfileAccess(req.profileId);
    const row = await networkDb.rawQueryRow<{
      id: string;
      profile_id: string;
      parent_node_id: string | null;
      sponsor_profile_id: string | null;
      position_index: number;
      depth: number;
      path: string;
    }>("SELECT id, profile_id, parent_node_id, sponsor_profile_id, position_index, depth, path FROM matrix_nodes WHERE profile_id = $1", req.profileId);
    return {
      node: row
        ? {
            id: row.id,
            profileId: row.profile_id,
            parentNodeId: row.parent_node_id,
            sponsorProfileId: row.sponsor_profile_id,
            positionIndex: row.position_index,
            depth: row.depth,
            path: row.path,
          }
        : null,
    };
  },
);

export const memberDownline = api<
  { profileId: string },
  { nodes: MatrixNodeResponse[] }
>(
  { method: "GET", path: "/matrix/me/:profileId/downline", expose: true },
  async (req) => {
    await requireProfileAccess(req.profileId);
    const root = await networkDb.rawQueryRow<{ path: string }>(
      "SELECT path FROM matrix_nodes WHERE profile_id = $1",
      req.profileId,
    );
    if (!root) return { nodes: [] };
    const rows = await networkDb.rawQueryAll<{
      id: string;
      profile_id: string;
      parent_node_id: string | null;
      sponsor_profile_id: string | null;
      position_index: number;
      depth: number;
      path: string;
    }>(
      `SELECT id, profile_id, parent_node_id, sponsor_profile_id, position_index, depth, path
       FROM matrix_nodes
       WHERE path = $1 OR path LIKE $1 || '.%'
       ORDER BY depth, position_index`,
      root.path,
    );
    return {
      nodes: rows.map((row) => ({
        id: row.id,
        profileId: row.profile_id,
        parentNodeId: row.parent_node_id,
        sponsorProfileId: row.sponsor_profile_id,
        positionIndex: row.position_index,
        depth: row.depth,
        path: row.path,
      })),
    };
  },
);

export const createKycCase = api<KycCaseCreateRequest, { id: string; status: string }>(
  { method: "POST", path: "/kyc/cases", expose: true },
  async (req) => {
    await requireProfileAccess(req.profileId);
    const payload = kycRequest.parse(req);
    const id = crypto.randomUUID();
    await kycDb.rawExec(`INSERT INTO kyc_cases (id, profile_id, provider, status, submitted_at)
       VALUES ($1, $2, $3, 'pending', now())`,
      id,
      req.profileId,
      payload.provider,
    );
    return { id, status: "pending" };
  },
);

export const getKycCase = api<{ id: string }, KycCaseResponse>(
  { method: "GET", path: "/kyc/cases/:id", expose: true },
  async (req) => {
    const row = await kycDb.rawQueryRow<{
      id: string;
      profile_id: string;
      provider: string;
      status: string;
    }>("SELECT id, profile_id, provider, status FROM kyc_cases WHERE id = $1", req.id);
    if (!row) {
      return { id: "", profileId: "", provider: "", status: "not_found" };
    }
    await requireProfileAccess(row.profile_id);
    return { id: row.id, profileId: row.profile_id, provider: row.provider, status: row.status };
  },
);

export const kycStatus = api<{ profileId: string }, { status: string; accountRef: string | null }>(
  { method: "GET", path: "/kyc/status/:profileId", expose: true },
  async (req) => {
    await requireProfileAccess(req.profileId);
    const row = await kycDb.rawQueryRow<{ status: string; result_payload: string }>(
      "SELECT status, result_payload::text AS result_payload FROM kyc_cases WHERE profile_id = $1 ORDER BY submitted_at DESC NULLS LAST LIMIT 1",
      req.profileId,
    );
    let accountRef: string | null = null;
    if (row?.result_payload) {
      try {
        const result = JSON.parse(row.result_payload) as { accountRef?: string };
        accountRef = result.accountRef ?? null;
      } catch {
        accountRef = null;
      }
    }
    return { status: row?.status.toUpperCase() ?? "NONE", accountRef };
  },
);

export const reviewProfileKyc = api<
  { profileId: string; action: "APPROVE" | "REJECT" },
  { profileId: string; kycStatus: string }
>(
  { method: "POST", path: "/admin/kyc/profiles/:profileId/review", expose: true },
  async (req) => {
    await requireAdminAccess();
    let kycCase = await kycDb.rawQueryRow<{ id: string }>(
      "SELECT id FROM kyc_cases WHERE profile_id = $1 ORDER BY submitted_at DESC NULLS LAST LIMIT 1",
      req.profileId,
    );
    if (!kycCase) {
      const id = crypto.randomUUID();
      await kycDb.rawExec(
        "INSERT INTO kyc_cases (id, profile_id, provider, status, submitted_at) VALUES ($1, $2, 'manual', 'pending', now())",
        id, req.profileId,
      );
      kycCase = { id };
    }
    const status = req.action === "APPROVE" ? "approved" : "rejected";
    await kycDb.rawExec(
      "UPDATE kyc_cases SET status = $2, reviewed_at = now() WHERE id = $1",
      kycCase.id, status,
    );
    await identityDb.rawExec("UPDATE profiles SET status = $2 WHERE id = $1", req.profileId, status === "approved" ? "active" : "rejected");
    await auditDb.rawExec(
      `INSERT INTO audit_logs (action, entity_type, entity_id, after)
       VALUES ($1, 'profile', $2, $3::jsonb)`,
      `kyc.${status}`, req.profileId, JSON.stringify({ kycCaseId: kycCase.id }),
    );
    return { profileId: req.profileId, kycStatus: status.toUpperCase().replace("APPROVED", "VERIFIED") };
  },
);

export const approveKycCase = api<
  { id: string },
  { ok: true }
>(
  { method: "POST", path: "/admin/kyc/cases/:id/approve", expose: true },
  async (req) => {
    await requireAdminAccess();
    await kycDb.rawExec(`UPDATE kyc_cases SET status = 'approved', reviewed_at = now() WHERE id = $1`,
      req.id,
    );
    await auditDb.rawExec(`INSERT INTO audit_logs (action, entity_type, entity_id, after)
       VALUES ($1, $2, $3, $4::jsonb)`,
      "kyc.approve",
      "kyc_cases",
      req.id,
      JSON.stringify({ status: "approved" }),
    );
    return { ok: true };
  },
);

export const listConfig = api<
  void,
  {
    versions: {
      config_key: string;
      version: number;
      config: Record<string, unknown>;
      effective_from: string;
    }[];
  }
>(
  { method: "GET", path: "/admin/config", expose: true },
  async () => {
    await requireAdminAccess();
    const rows = await membershipDb.rawQueryAll<{
      config_key: string;
      version: number;
      config: Record<string, unknown>;
      effective_from: string;
    }>(
      "SELECT config_key, version, config, effective_from FROM business_config_versions ORDER BY config_key, version DESC",
    );

    return { versions: rows };
  },
);

export const addConfigVersion = api<{ key: string; config: Record<string, unknown> }, { ok: true }>(
  { method: "POST", path: "/admin/config/:key/version", expose: true },
  async (req) => {
    await requireAdminAccess();
    const { config } = configVersion.parse(req);
    await membershipDb.rawExec(`INSERT INTO business_config_versions (config_key, version, config)
       VALUES ($1, COALESCE((SELECT MAX(version) + 1 FROM business_config_versions WHERE config_key = $1), 1), $2::jsonb)`,
      req.key,
      JSON.stringify(config),
    );
    await auditDb.rawExec(`INSERT INTO audit_logs (action, entity_type, entity_id, after)
       VALUES ($1, $2, gen_random_uuid(), $3::jsonb)`,
      "config.version.create",
      "business_config_versions",
      JSON.stringify({ key: req.key, config }),
    );
    return { ok: true };
  },
);

export const listAuditLogs = api<
  void,
  {
    logs: {
      action: string;
      entity_type: string;
      entity_id: string | null;
      created_at: string;
    }[];
  }
>(
  { method: "GET", path: "/admin/audit-logs", expose: true },
  async () => {
    await requireAdminAccess();
    const rows = await auditDb.rawQueryAll<{
      action: string;
      entity_type: string;
      entity_id: string | null;
      created_at: string;
    }>("SELECT action, entity_type, entity_id, created_at FROM audit_logs ORDER BY created_at DESC LIMIT 100",
    );

  return { logs: rows };
  },
);

export const myShares = api<
  { profileId: string },
  { certificates: { certificateNumber: string; totalShares: number; status: string; issuedAt: string; revokedAt: string | null }[] }
>(
  { method: "GET", path: "/shares/me/:profileId", expose: true },
  async (req) => {
    await requireProfileAccess(req.profileId);
    const rows = await sharesDb.rawQueryAll<{
      certificate_number: string;
      total_shares: number;
      status: string;
      issued_at: string;
      revoked_at: string | null;
    }>("SELECT certificate_number, total_shares, status, issued_at, revoked_at FROM share_certificates WHERE profile_id = $1 ORDER BY issued_at DESC",
      req.profileId,
    );
    return {
      certificates: rows.map((row) => ({
        certificateNumber: row.certificate_number,
        totalShares: row.total_shares,
        status: row.status,
        issuedAt: row.issued_at,
        revokedAt: row.revoked_at,
      })),
    };
  },
);

export const revokeShareCertificate = api<
  { certificateNumber: string },
  { ok: true }
>(
  { method: "POST", path: "/admin/shares/certificates/:certificateNumber/revoke", expose: true },
  async (req) => {
    await requireAdminAccess();
    await sharesDb.rawExec(`UPDATE share_certificates SET status = 'revoked', revoked_at = now() WHERE certificate_number = $1`,
      req.certificateNumber,
    );
    await auditDb.rawExec(`INSERT INTO audit_logs (action, entity_type, entity_id, after)
       VALUES ($1, $2, gen_random_uuid(), $3::jsonb)`,
      "shares.certificate.revoke",
      "share_certificates",
      JSON.stringify({ certificateNumber: req.certificateNumber }),
    );
    return { ok: true };
  },
);

export const reissueShareCertificate = api<
  { profileId: string },
  { certificateNumber: string; status: string }
>(
  { method: "POST", path: "/admin/shares/certificates/reissue", expose: true },
  async (req) => {
    await requireAdminAccess();
    const previous = await sharesDb.rawQueryRow<{ certificate_number: string }>("SELECT certificate_number FROM share_certificates WHERE profile_id = $1 ORDER BY issued_at DESC LIMIT 1",
      req.profileId,
    );
    if (previous) {
      await sharesDb.rawExec(`UPDATE share_certificates SET status = 'revoked', revoked_at = now() WHERE certificate_number = $1`,
        previous.certificate_number,
      );
    }
    const total = await sharesDb.rawQueryRow<{ total: string }>("SELECT COALESCE(SUM(total_shares), 0)::text AS total FROM share_certificates WHERE profile_id = $1 AND status <> 'revoked'",
      req.profileId,
    );
    const certificateNumber = `CERT-${String(Date.now()).slice(-10)}`;
    await sharesDb.rawExec(`INSERT INTO share_certificates (profile_id, certificate_number, total_shares, status, issued_at)
       VALUES ($1, $2, $3::int, 'issued', now())`,
      req.profileId,
      certificateNumber,
      Number(total?.total ?? "0"),
    );
    await auditDb.rawExec(`INSERT INTO audit_logs (action, entity_type, entity_id, after)
       VALUES ($1, $2, gen_random_uuid(), $3::jsonb)`,
      "shares.certificate.reissue",
      "share_certificates",
      JSON.stringify({ profileId: req.profileId, certificateNumber }),
    );
    return { certificateNumber, status: "issued" };
  },
);

type AdminMemberResponse = {
  id: string; profileNumber: string; membershipType: string; citizenshipType: string | null;
  firstName: string | null; lastName: string | null; companyName: string | null; email: string;
  country: string; mobile: string; kycStatus: string; kycVerifiedAt: string | null;
  subscriptionStatus: string; subscriptionAmount: number; subscriptionCurrency: string;
  monthlyEarnings: number; taxThreshold: boolean; nfcTagId: string; instapayStatus: string;
  instapayVerifiedAt: string | null; instapayAccountRef: string | null; uplineProfileNumber: string | null;
  uplineConfirmed: boolean; createdAt: string; shareCount: number; transactionCount: number; orderCount: number;
};

export const adminMemberProfiles = api<
  { search?: string; kyc?: string; subscription?: string; type?: string; limit?: number; offset?: number },
  { members: AdminMemberResponse[]; total: number; limit: number; offset: number }
>(
  { method: "GET", path: "/admin/member-profiles", expose: true },
  async (req) => {
    await requireAdminAccess();
    const rows = await identityDb.rawQueryAll<{
      id: string; profile_number: string; profile_type: string; first_name: string | null; surname: string | null;
      membership_type: string | null; citizenship_type: string | null; company_name: string | null; email: string;
      country: string | null; phone: string | null; status: string; kyc_verified_at: string | null;
      monthly_earnings: string; tax_threshold: boolean; nfc_tag_id: string | null; instapay_status: string;
      instapay_verified_at: string | null; instapay_account_ref: string | null; upline_profile_number: string | null;
      upline_confirmed: boolean; created_at: string;
    }>(
      `SELECT p.id, p.unique_profile_number AS profile_number, p.profile_type, p.first_name, p.surname,
              p.membership_type, p.citizenship_type, p.company_name, u.email, p.country, u.phone, p.status,
              p.kyc_verified_at, p.monthly_earnings::text AS monthly_earnings, p.tax_threshold, p.nfc_tag_id,
              p.instapay_status, p.instapay_verified_at, p.instapay_account_ref, p.upline_profile_number,
              p.upline_confirmed, p.created_at
       FROM profiles p JOIN users u ON u.id = p.user_id ORDER BY p.created_at DESC`,
    );
    const enriched: AdminMemberResponse[] = [];
    for (const row of rows) {
      const [subscription, kyc, shares, transactions, orders] = await Promise.all([
        membershipDb.rawQueryRow<{ status: string; amount: string; currency: string }>(
          `SELECT s.status, mp.amount::text AS amount, mp.currency FROM subscriptions s
           JOIN membership_plans mp ON mp.id = s.plan_id WHERE s.profile_id = $1 ORDER BY s.starts_at DESC LIMIT 1`, row.id,
        ),
        kycDb.rawQueryRow<{ status: string; reviewed_at: string | null }>(
          "SELECT status, reviewed_at FROM kyc_cases WHERE profile_id = $1 ORDER BY submitted_at DESC NULLS LAST LIMIT 1", row.id,
        ),
        sharesDb.rawQueryRow<{ total: string }>("SELECT COALESCE(SUM(total_shares), 0)::text AS total FROM share_certificates WHERE profile_id = $1 AND status <> 'revoked'", row.id),
        financeDb.rawQueryRow<{ count: string }>(
          `SELECT COUNT(DISTINCT lt.id)::text AS count FROM ledger_transactions lt
           JOIN ledger_entries le ON le.transaction_id = lt.id JOIN ledger_accounts la ON la.id = le.account_id
           WHERE la.owner_type = 'profile' AND la.owner_id = $1`, row.id,
        ),
        commerceDb.rawQueryRow<{ count: string }>("SELECT COUNT(*)::text AS count FROM marketplace_orders WHERE profile_id = $1", row.id),
      ]);
      const kycStatusValue = kyc
        ? (kyc.status === "approved" ? "VERIFIED" : kyc.status.toUpperCase())
        : (row.status === "active" ? "VERIFIED" : row.status === "rejected" ? "REJECTED" : "PENDING");
      const subscriptionStatus = subscription?.status.toLowerCase();
      enriched.push({
        id: row.id, profileNumber: row.profile_number, membershipType: row.membership_type ?? row.profile_type.toUpperCase(), citizenshipType: row.citizenship_type,
        firstName: row.first_name, lastName: row.surname, companyName: row.company_name, email: row.email,
        country: row.country ?? "ZA", mobile: row.phone ?? "", kycStatus: kycStatusValue, kycVerifiedAt: kyc?.reviewed_at ?? row.kyc_verified_at,
        subscriptionStatus: subscriptionStatus === "active" || subscriptionStatus === "paid" ? "ACTIVE" : subscriptionStatus?.toUpperCase() ?? "PENDING",
        subscriptionAmount: Number(subscription?.amount ?? 0), subscriptionCurrency: subscription?.currency ?? "ZAR",
        monthlyEarnings: Number(row.monthly_earnings), taxThreshold: row.tax_threshold,
        nfcTagId: row.nfc_tag_id ?? `NFC-${row.id.slice(0, 12).toUpperCase()}`, instapayStatus: row.instapay_status,
        instapayVerifiedAt: row.instapay_verified_at, instapayAccountRef: row.instapay_account_ref,
        uplineProfileNumber: row.upline_profile_number, uplineConfirmed: row.upline_confirmed, createdAt: row.created_at,
        shareCount: Number(shares?.total ?? 0), transactionCount: Number(transactions?.count ?? 0), orderCount: Number(orders?.count ?? 0),
      });
    }
    const search = (req.search ?? "").toLowerCase();
    const filtered = enriched.filter((member) => {
      const searchable = [member.firstName, member.lastName, member.companyName, member.email, member.profileNumber, member.mobile].filter(Boolean).join(" ").toLowerCase();
      return (!search || searchable.includes(search))
        && (!req.kyc || req.kyc === "ALL" || member.kycStatus === req.kyc)
        && (!req.subscription || req.subscription === "ALL" || member.subscriptionStatus === req.subscription)
        && (!req.type || req.type === "ALL" || member.membershipType === req.type);
    });
    const limit = Math.min(Math.max(req.limit ?? 100, 1), 500);
    const offset = Math.max(req.offset ?? 0, 0);
    return { members: filtered.slice(offset, offset + limit), total: filtered.length, limit, offset };
  },
);

export const listMembers = api<
  void,
  { members: { profileId: string; email: string; profileNumber: string; status: string; membershipStatus: string | null; walletBalance: string | null }[] }
>(
  { method: "GET", path: "/admin/members", expose: true },
  async () => {
    await requireAdminAccess();
    const rows = await identityDb.rawQueryAll<{
      profile_id: string;
      email: string;
      unique_profile_number: string;
      profile_status: string;
    }>(
      `SELECT p.id AS profile_id, u.email, p.unique_profile_number, p.status AS profile_status
       FROM profiles p
       JOIN users u ON u.id = p.user_id
       ORDER BY p.created_at DESC`,
    );
    const members: {
      profileId: string;
      email: string;
      profileNumber: string;
      status: string;
      membershipStatus: string | null;
      walletBalance: string | null;
    }[] = [];
    for (const row of rows) {
      const membership = await membershipDb.rawQueryRow<{ status: string | null }>(
        "SELECT status FROM subscriptions WHERE profile_id = $1 ORDER BY starts_at DESC LIMIT 1",
        row.profile_id,
      );
      const wallet = await networkDb.rawQueryRow<{ cached_balance: string | null }>(
        "SELECT cached_balance::text AS cached_balance FROM wallets WHERE profile_id = $1 ORDER BY created_at DESC LIMIT 1",
        row.profile_id,
      );
      members.push({
        profileId: row.profile_id,
        email: row.email,
        profileNumber: row.unique_profile_number,
        status: row.profile_status,
        membershipStatus: membership?.status ?? null,
        walletBalance: wallet?.cached_balance ?? null,
      });
    }
    return {
      members,
    };
  },
);

export const financialSummary = api<
  void,
  { totalLedgerTransactions: number; totalWalletBalance: string; totalSharePurchases: number }
>(
  { method: "GET", path: "/admin/reports/financial-summary", expose: true },
  async () => {
    await requireAdminAccess();
    const tx = await financeDb.rawQueryRow<{ count: string }>("SELECT COUNT(*)::text AS count FROM ledger_transactions");
    const wallet = await networkDb.rawQueryRow<{ total: string }>("SELECT COALESCE(SUM(cached_balance), 0)::text AS total FROM wallets");
    const shares = await sharesDb.rawQueryRow<{ count: string }>("SELECT COUNT(*)::text AS count FROM share_purchases");
    return {
      totalLedgerTransactions: Number(tx?.count ?? "0"),
      totalWalletBalance: wallet?.total ?? "0",
      totalSharePurchases: Number(shares?.count ?? "0"),
    };
  },
);

export const listSharePhases = api<
  void,
  { phases: SharePhaseResponse[] }
>(
  { method: "GET", path: "/shares/phases", expose: true },
  async () => {
    const rows = await sharesDb.rawQueryAll<{
      id: string;
      phase_number: number;
      quantity_available: number;
      price_per_share: string;
      currency: string;
      status: string;
    }>("SELECT id, phase_number, quantity_available, price_per_share::text AS price_per_share, currency, status FROM share_phases ORDER BY phase_number");
    if (rows.length === 0) {
      await sharesDb.rawExec(`INSERT INTO share_phases (phase_number, quantity_available, price_per_share, currency, status, starts_at)
         VALUES (1, 100000, 25.00, 'USD', 'active', now())
         ON CONFLICT (phase_number) DO UPDATE SET quantity_available = EXCLUDED.quantity_available, price_per_share = EXCLUDED.price_per_share, currency = EXCLUDED.currency, status = EXCLUDED.status`,
      );
      const seeded = await sharesDb.rawQueryAll<{
        id: string;
        phase_number: number;
        quantity_available: number;
        price_per_share: string;
        currency: string;
        status: string;
      }>("SELECT id, phase_number, quantity_available, price_per_share::text AS price_per_share, currency, status FROM share_phases ORDER BY phase_number");
      return {
        phases: seeded.map((row) => ({
          id: row.id,
          phaseNumber: row.phase_number,
          quantityAvailable: row.quantity_available,
          pricePerShare: row.price_per_share,
          currency: row.currency,
          status: row.status,
        })),
      };
    }
    return {
      phases: rows.map((row) => ({
        id: row.id,
        phaseNumber: row.phase_number,
        quantityAvailable: row.quantity_available,
        pricePerShare: row.price_per_share,
        currency: row.currency,
        status: row.status,
      })),
    };
  },
);

export const purchaseShares = api<SharePurchaseRequest, SharePurchaseResponse>(
  { method: "POST", path: "/shares/purchase", expose: true },
  async (req) => {
    const payload = sharePurchaseRequest.parse(req);
    const session = await requireProfileAccess(payload.profileId);
    const idempotencyKey = requireIdempotencyKey();
    const started = await beginOperation<SharePurchaseResponse>({
      operationType: "share_purchase",
      actorUserId: session.user.id,
      profileId: payload.profileId,
      idempotencyKey,
      payload,
    });
    if (started.operation.state === "completed" && started.operation.result) return started.operation.result;

    const operation = started.operation;
    let reservationCreated = false;
    try {
      let purchase = await sharesDb.rawQueryRow<{
        id: string; phase_id: string; quantity: number; bonus_quantity: number; total_amount: string; status: string; certificate_id: string | null;
      }>(`SELECT id, phase_id, quantity, bonus_quantity, total_amount::text AS total_amount, status, certificate_id
          FROM share_purchases WHERE operation_id = $1`, operation.id);

      if (!purchase) {
        const tx = await sharesDb.begin();
        try {
          const phase = await tx.rawQueryRow<{ id: string; price_per_share: string; currency: string; bonus_buy_one_get: boolean }>(
            `UPDATE share_phases
             SET quantity_available = quantity_available - CASE WHEN bonus_buy_one_get THEN $2 * 2 ELSE $2 END,
                 updated_at = now()
             WHERE phase_number = $1 AND status = 'active'
               AND quantity_available >= CASE WHEN bonus_buy_one_get THEN $2 * 2 ELSE $2 END
             RETURNING id, price_per_share::text AS price_per_share, currency, bonus_buy_one_get`,
            payload.phaseNumber, payload.quantity,
          );
          if (!phase) throw APIError.failedPrecondition("Share phase is closed or does not have enough inventory");
          const bonusQuantity = phase.bonus_buy_one_get ? payload.quantity : 0;
          const totalAmount = (Number(phase.price_per_share) * payload.quantity).toFixed(2);
          const purchaseId = crypto.randomUUID();
          await tx.rawExec(`INSERT INTO share_purchases
             (id, profile_id, phase_id, quantity, bonus_quantity, total_amount, status, operation_id, created_at)
             VALUES ($1, $2, $3, $4, $5, $6::numeric, 'reserved', $7, now())`,
            purchaseId, payload.profileId, phase.id, payload.quantity, bonusQuantity, totalAmount, operation.id);
          await tx.commit();
          reservationCreated = true;
          purchase = { id: purchaseId, phase_id: phase.id, quantity: payload.quantity, bonus_quantity: bonusQuantity, total_amount: totalAmount, status: "reserved", certificate_id: null };
          await recordStep(operation, "reserve_inventory", "completed", {
            purchaseId,
            phaseNumber: payload.phaseNumber,
            purchasedQuantity: payload.quantity,
            bonusQuantity,
            reservedQuantity: payload.quantity + bonusQuantity,
          });
        } catch (error) { await tx.rollback(); throw error; }
      } else if (purchase.status === "failed") {
        const tx = await sharesDb.begin();
        try {
          const restored = await tx.rawQueryRow<{ id: string }>(`UPDATE share_phases
            SET quantity_available = quantity_available - $2, updated_at = now()
            WHERE id = $1 AND status = 'active' AND quantity_available >= $2 RETURNING id`,
            purchase.phase_id, purchase.quantity + purchase.bonus_quantity);
          if (!restored) throw APIError.failedPrecondition("Share phase is closed or does not have enough inventory");
          await tx.rawExec("UPDATE share_purchases SET status = 'reserved' WHERE id = $1", purchase.id);
          await tx.commit();
          purchase.status = "reserved";
          reservationCreated = true;
          await recordStep(operation, "reserve_inventory", "completed", {
            purchaseId: purchase.id,
            restored: true,
            purchasedQuantity: purchase.quantity,
            bonusQuantity: purchase.bonus_quantity,
            reservedQuantity: purchase.quantity + purchase.bonus_quantity,
          });
        } catch (error) { await tx.rollback(); throw error; }
      }

      const phaseCurrency = await sharesDb.rawQueryRow<{ currency: string }>("SELECT currency FROM share_phases WHERE id = $1", purchase.phase_id);
      if (!phaseCurrency) throw new Error("share_phase_not_found");
      await placeWalletHold(operation, payload.profileId, phaseCurrency.currency, purchase.total_amount);
      await recordStep(operation, "hold_wallet_funds", "completed", { amount: purchase.total_amount, currency: phaseCurrency.currency });

      await captureWalletHold(operation, "share_revenue", "Wallet-funded share purchase");
      await recordStep(operation, "capture_wallet_funds", "completed", { amount: purchase.total_amount, currency: phaseCurrency.currency });

      let certificate = purchase.certificate_id
        ? await sharesDb.rawQueryRow<{ id: string; certificate_number: string }>("SELECT id, certificate_number FROM share_certificates WHERE id = $1", purchase.certificate_id)
        : null;
      if (!certificate) {
        const tx = await sharesDb.begin();
        try {
          const locked = await tx.rawQueryRow<{ certificate_id: string | null; status: string }>(
            "SELECT certificate_id, status FROM share_purchases WHERE id = $1 FOR UPDATE", purchase.id);
          if (!locked) throw new Error("share_purchase_not_found");
          if (locked.certificate_id) {
            certificate = await tx.rawQueryRow<{ id: string; certificate_number: string }>(
              "SELECT id, certificate_number FROM share_certificates WHERE id = $1", locked.certificate_id);
          } else {
            const certificateId = crypto.randomUUID();
            const certificateNumber = `CERT-${crypto.randomUUID().toUpperCase()}`;
            await tx.rawExec(`INSERT INTO share_certificates (id, profile_id, certificate_number, total_shares, status, issued_at)
               VALUES ($1, $2, $3, $4, 'issued', now())`,
              certificateId, payload.profileId, certificateNumber, purchase.quantity + purchase.bonus_quantity);
            await tx.rawExec("UPDATE share_purchases SET certificate_id = $2, status = 'paid' WHERE id = $1", purchase.id, certificateId);
            certificate = { id: certificateId, certificate_number: certificateNumber };
          }
          await tx.commit();
        } catch (error) { await tx.rollback(); throw error; }
      }
      if (!certificate) throw new Error("share_certificate_not_created");
      await recordStep(operation, "issue_certificate", "completed", { purchaseId: purchase.id, certificateNumber: certificate.certificate_number });

      const priorAudit = await auditDb.rawQueryRow<{ id: string }>(
        "SELECT id FROM audit_logs WHERE action = 'shares.purchase' AND entity_id = $1 LIMIT 1", purchase.id);
      if (!priorAudit) {
        await auditDb.rawExec(`INSERT INTO audit_logs (action, entity_type, entity_id, actor_user_id, after)
           VALUES ('shares.purchase', 'share_purchases', $1, $2, $3::jsonb)`,
          purchase.id, session.user.id, JSON.stringify({ operationId: operation.id, profileId: payload.profileId, phaseNumber: payload.phaseNumber, quantity: purchase.quantity, bonusQuantity: purchase.bonus_quantity, totalAmount: purchase.total_amount }));
      }
      await recordStep(operation, "audit", "completed", { purchaseId: purchase.id });

      const result: SharePurchaseResponse = {
        operationId: operation.id,
        purchaseId: purchase.id,
        status: "completed",
        totalAmount: purchase.total_amount,
        bonusQuantity: purchase.bonus_quantity,
        certificateNumber: certificate.certificate_number,
      };
      return await completeOperation(operation, result);
    } catch (error) {
      if (reservationCreated) {
        const hold = await financeDb.rawQueryRow<{ state: string }>("SELECT state FROM wallet_holds WHERE operation_id = $1", operation.id);
        if (!hold) {
          const tx = await sharesDb.begin();
          try {
            const reservation = await tx.rawQueryRow<{ phase_id: string; quantity: number; bonus_quantity: number; status: string }>(
              "SELECT phase_id, quantity, bonus_quantity, status FROM share_purchases WHERE operation_id = $1 FOR UPDATE", operation.id);
            if (reservation?.status === "reserved") {
              await tx.rawExec(
                "UPDATE share_phases SET quantity_available = quantity_available + $2, updated_at = now() WHERE id = $1",
                reservation.phase_id,
                reservation.quantity + reservation.bonus_quantity,
              );
              await tx.rawExec("UPDATE share_purchases SET status = 'failed' WHERE operation_id = $1", operation.id);
            }
            await tx.commit();
          } catch (compensationError) { await tx.rollback(); await recordStep(operation, "release_inventory", "failed", {}, compensationError); }
        }
      }
      return failOperation(operation, error, true);
    }
  },
);

export const updateSharePhase = api<
  { phaseId: string; pricePerShare?: number; totalShares?: number; status?: string; bonusBuyOneGet?: boolean },
  { phase: SharePhaseResponse }
>(
  { method: "PATCH", path: "/admin/shares/phases/:phaseId", expose: true },
  async (req) => {
    await requireAdminAccess();
    const existing = await sharesDb.rawQueryRow<{ total_quantity: number; quantity_available: number }>(
      "SELECT total_quantity, quantity_available FROM share_phases WHERE id = $1",
      req.phaseId,
    );
    if (!existing) throw new Error("phase_not_found");
    const sold = existing.total_quantity - existing.quantity_available;
    if (req.totalShares !== undefined && req.totalShares < sold) throw new Error("total_below_sold");
    const row = await sharesDb.rawQueryRow<{
      id: string; phase_number: number; quantity_available: number; total_quantity: number; price_per_share: string;
      currency: string; status: string; bonus_buy_one_get: boolean; created_at: string; updated_at: string;
    }>(
      `UPDATE share_phases SET
         price_per_share = COALESCE($2::numeric, price_per_share),
         total_quantity = COALESCE($3, total_quantity),
         quantity_available = CASE WHEN $3::int IS NULL THEN quantity_available ELSE $3::int - $6::int END,
         status = COALESCE($4, status), bonus_buy_one_get = COALESCE($5, bonus_buy_one_get), updated_at = now()
       WHERE id = $1
       RETURNING id, phase_number, quantity_available, total_quantity, price_per_share::text AS price_per_share,
                 currency, status, bonus_buy_one_get, created_at, updated_at`,
      req.phaseId,
      req.pricePerShare?.toFixed(2) ?? null,
      req.totalShares ?? null,
      req.status ? req.status.toLowerCase().replace("open", "active") : null,
      req.bonusBuyOneGet ?? null,
      sold,
    );
    if (!row) throw new Error("phase_not_found");
    return { phase: { id: row.id, phaseNumber: row.phase_number, quantityAvailable: row.quantity_available, totalShares: row.total_quantity, pricePerShare: row.price_per_share, currency: row.currency, status: row.status, bonusBuyOneGet: row.bonus_buy_one_get, createdAt: row.created_at, updatedAt: row.updated_at } };
  },
);

export const adminShareCertificates = api<
  { limit?: number },
  { shares: { id: string; profileId: string; phase: number; pricePerShare: number; quantity: number; totalAmount: number; certificateNo: string; status: string; createdAt: string }[] }
>(
  { method: "GET", path: "/admin/shares", expose: true },
  async (req) => {
    await requireAdminAccess();
    const rows = await sharesDb.rawQueryAll<{
      id: string; profile_id: string; phase_number: number; price_per_share: string; total_shares: number;
      total_amount: string; certificate_number: string; status: string; issued_at: string;
    }>(
      `SELECT c.id, c.profile_id, COALESCE(p.phase_number, 1) AS phase_number,
              COALESCE(p.price_per_share, 0)::text AS price_per_share, c.total_shares,
              COALESCE(sp.total_amount, 0)::text AS total_amount, c.certificate_number, c.status, c.issued_at
       FROM share_certificates c
       LEFT JOIN LATERAL (
         SELECT purchase.phase_id, purchase.total_amount FROM share_purchases purchase
         WHERE purchase.profile_id = c.profile_id AND purchase.created_at <= c.issued_at
         ORDER BY purchase.created_at DESC LIMIT 1
       ) sp ON true
       LEFT JOIN share_phases p ON p.id = sp.phase_id
       ORDER BY c.issued_at DESC LIMIT $1`,
      Math.min(Math.max(req.limit ?? 50, 1), 500),
    );
    return { shares: rows.map((row) => ({ id: row.id, profileId: row.profile_id, phase: row.phase_number, pricePerShare: Number(row.price_per_share), quantity: row.total_shares, totalAmount: Number(row.total_amount), certificateNo: row.certificate_number, status: row.status.toUpperCase(), createdAt: row.issued_at })) };
  },
);

type MarketplaceProductRow = {
  id: string;
  name: string;
  description: string;
  category: string;
  provider: string;
  price: string;
  free_price: string;
  currency: string;
  commission_pct: string;
  image_color: string;
  rating: string;
  popular: boolean;
  created_at: string;
};

type MarketplaceProductResponse = {
  id: string;
  name: string;
  description: string;
  category: string;
  provider: string;
  price: number;
  freePrice: number;
  currency: string;
  commissionPct: number;
  imageColor: string;
  rating: number;
  popular: boolean;
  createdAt: string;
  displayPrice?: number;
};

type MarketplaceOrderResponse = {
  id: string;
  productId: string;
  productName: string;
  amount: number;
  commission: number;
  pricingTier: string;
  status: string;
  createdAt: string;
};

export const marketplace = api<
  { profileId?: string; category?: string },
  { products: MarketplaceProductResponse[]; recentOrders: MarketplaceOrderResponse[]; isFreeMember: boolean; pricingTier: string }
>(
  { method: "GET", path: "/marketplace", expose: true },
  async (req) => {
    let isFreeMember = false;
    if (req.profileId) {
      await requireProfileAccess(req.profileId);
      const subscription = await membershipDb.rawQueryRow<{ status: string }>(
        "SELECT status FROM subscriptions WHERE profile_id = $1 ORDER BY starts_at DESC LIMIT 1",
        req.profileId,
      );
      isFreeMember = subscription?.status !== "active";
    }
    const products = await commerceDb.rawQueryAll<MarketplaceProductRow>(
      `SELECT id, name, description, category, provider, price::text AS price,
              free_price::text AS free_price, currency, commission_pct::text AS commission_pct,
              image_color, rating::text AS rating, popular, created_at
       FROM marketplace_products
       WHERE ($1 = '' OR $1 = 'ALL' OR category = $1)
       ORDER BY popular DESC, name`,
      req.category ?? "",
    );
    const orders = req.profileId
      ? await commerceDb.rawQueryAll<{
          id: string; product_id: string; product_name: string; amount: string; commission: string;
          pricing_tier: string; status: string; created_at: string;
        }>(
          `SELECT id, product_id, product_name, amount::text AS amount, commission::text AS commission,
                  pricing_tier, status, created_at
           FROM marketplace_orders WHERE profile_id = $1 ORDER BY created_at DESC LIMIT 8`,
          req.profileId,
        )
      : [];
    return {
      products: products.map((product) => ({
        ...marketplaceProduct(product),
        displayPrice: Number(isFreeMember ? product.free_price : product.price),
      })),
      recentOrders: orders.map((order) => ({
        id: order.id,
        productId: order.product_id,
        productName: order.product_name,
        amount: Number(order.amount),
        commission: Number(order.commission),
        pricingTier: order.pricing_tier,
        status: order.status,
        createdAt: order.created_at,
      })),
      isFreeMember,
      pricingTier: isFreeMember ? "FREE" : "PAID",
    };
  },
);

export const placeMarketplaceOrder = api<
  { profileId: string; productId: string },
  { order: MarketplaceOrderResponse; price: number; pricingTier: string; commission: number; poolBenefit: number; operationId: string; status: string }
>(
  { method: "POST", path: "/marketplace/orders", expose: true },
  async (req) => {
    const session = await requireProfileAccess(req.profileId);
    const idempotencyKey = requireIdempotencyKey();
    const product = await commerceDb.rawQueryRow<MarketplaceProductRow>(
      `SELECT id, name, description, category, provider, price::text AS price,
              free_price::text AS free_price, currency, commission_pct::text AS commission_pct,
              image_color, rating::text AS rating, popular, created_at
       FROM marketplace_products WHERE id = $1`,
      req.productId,
    );
    if (!product) throw new Error("product_not_found");
    const subscription = await membershipDb.rawQueryRow<{ status: string }>(
      "SELECT status FROM subscriptions WHERE profile_id = $1 ORDER BY starts_at DESC LIMIT 1",
      req.profileId,
    );
    const isFreeMember = subscription?.status !== "active";
    const price = Number(isFreeMember ? product.free_price : product.price);
    const pricingTier = isFreeMember ? "FREE" : "PAID";
    const commission = Number((price * Number(product.commission_pct) / 100).toFixed(2));
    const started = await beginOperation<{
      order: MarketplaceOrderResponse; price: number; pricingTier: string; commission: number; poolBenefit: number; operationId: string; status: string;
    }>({ operationType: "marketplace_order", actorUserId: session.user.id, profileId: req.profileId, idempotencyKey, payload: req });
    if (started.operation.state === "completed" && started.operation.result) return started.operation.result;
    const operation = started.operation;
    try {
      let order = await commerceDb.rawQueryRow<{
        id: string; created_at: string; status: string; amount: string; commission: string; pricing_tier: string; currency: string;
      }>(`SELECT id, created_at, status, amount::text AS amount, commission::text AS commission, pricing_tier, currency
          FROM marketplace_orders WHERE operation_id = $1`, operation.id);
      if (!order) {
        order = await commerceDb.rawQueryRow(`INSERT INTO marketplace_orders
          (id, profile_id, product_id, product_name, amount, pricing_tier, commission, status, operation_id, currency)
          VALUES ($1, $2, $3, $4, $5::numeric, $6, $7::numeric, 'PROCESSING', $8, $9)
          RETURNING id, created_at, status, amount::text AS amount, commission::text AS commission, pricing_tier, currency`,
          crypto.randomUUID(), req.profileId, product.id, product.name, price.toFixed(2), pricingTier, commission.toFixed(2), operation.id, product.currency);
      }
      if (!order) throw new Error("marketplace_order_not_created");
      await recordStep(operation, "create_order", "completed", { orderId: order.id });
      await placeWalletHold(operation, req.profileId, order.currency, order.amount);
      await recordStep(operation, "hold_wallet_funds", "completed", { amount: order.amount, currency: order.currency });
      await captureWalletHold(operation, "marketplace_revenue", `${product.name} - ${product.provider}`);
      await recordStep(operation, "capture_wallet_funds", "completed", { orderId: order.id });
      await commerceDb.rawExec("UPDATE marketplace_orders SET status = 'COMPLETED' WHERE id = $1", order.id);
      const orderPrice = Number(order.amount);
      const orderCommission = Number(order.commission);
      const result = {
        order: { id: order.id, productId: product.id, productName: product.name, amount: orderPrice, commission: orderCommission, pricingTier: order.pricing_tier, status: "COMPLETED", createdAt: order.created_at },
        price: orderPrice, pricingTier: order.pricing_tier, commission: orderCommission,
        poolBenefit: Number((orderCommission * 0.05).toFixed(2)), operationId: operation.id, status: "completed",
      };
      return completeOperation(operation, result);
    } catch (error) {
      try { await releaseWalletHold(operation.id); } catch { /* captured funds require reconciliation, not release */ }
      return failOperation(operation, error);
    }
  },
);

export const adminMarketplace = api<void, { products: MarketplaceProductResponse[]; orders: MarketplaceOrderResponse[] }>(
  { method: "GET", path: "/admin/marketplace", expose: true },
  async () => {
    await requireAdminAccess();
    const products = await commerceDb.rawQueryAll<MarketplaceProductRow>(
      `SELECT id, name, description, category, provider, price::text AS price, free_price::text AS free_price,
              currency, commission_pct::text AS commission_pct, image_color, rating::text AS rating, popular, created_at
       FROM marketplace_products ORDER BY popular DESC, name`,
    );
    const orders = await commerceDb.rawQueryAll<{
      id: string; product_id: string; product_name: string; amount: string; commission: string;
      pricing_tier: string; status: string; created_at: string;
    }>(
      `SELECT id, product_id, product_name, amount::text AS amount, commission::text AS commission,
              pricing_tier, status, created_at FROM marketplace_orders ORDER BY created_at DESC LIMIT 50`,
    );
    return {
      products: products.map(marketplaceProduct),
      orders: orders.map((order) => ({ id: order.id, productId: order.product_id, productName: order.product_name, amount: Number(order.amount), commission: Number(order.commission), pricingTier: order.pricing_tier, status: order.status, createdAt: order.created_at })),
    };
  },
);

export const createMarketplaceProduct = api<
  { name: string; description: string; category: string; provider: string; price: number; freePrice?: number; commissionPct?: number; imageColor?: string; rating?: number; popular?: boolean },
  { product: MarketplaceProductResponse }
>(
  { method: "POST", path: "/admin/marketplace/products", expose: true },
  async (req) => {
    await requireAdminAccess();
    const row = await commerceDb.rawQueryRow<MarketplaceProductRow>(
      `INSERT INTO marketplace_products (name, description, category, provider, price, free_price, commission_pct, image_color, rating, popular)
       VALUES ($1, $2, $3, $4, $5::numeric, $6::numeric, $7::numeric, $8, $9::numeric, $10)
       RETURNING id, name, description, category, provider, price::text AS price, free_price::text AS free_price,
                 currency, commission_pct::text AS commission_pct, image_color, rating::text AS rating, popular, created_at`,
      req.name, req.description, req.category, req.provider, req.price.toFixed(2),
      (req.freePrice ?? req.price * 1.15).toFixed(2), (req.commissionPct ?? 0).toFixed(4),
      req.imageColor ?? "emerald", (req.rating ?? 4.5).toFixed(2), req.popular ?? false,
    );
    if (!row) throw new Error("product_create_failed");
    return { product: marketplaceProduct(row) };
  },
);

export const updateMarketplaceProduct = api<
  { productId: string; name?: string; description?: string; category?: string; provider?: string; price?: number; freePrice?: number; commissionPct?: number; imageColor?: string; rating?: number; popular?: boolean },
  { product: MarketplaceProductResponse }
>(
  { method: "PATCH", path: "/admin/marketplace/products/:productId", expose: true },
  async (req) => {
    await requireAdminAccess();
    const row = await commerceDb.rawQueryRow<MarketplaceProductRow>(
      `UPDATE marketplace_products SET
         name = COALESCE($2, name), description = COALESCE($3, description), category = COALESCE($4, category),
         provider = COALESCE($5, provider), price = COALESCE($6::numeric, price), free_price = COALESCE($7::numeric, free_price),
         commission_pct = COALESCE($8::numeric, commission_pct), image_color = COALESCE($9, image_color),
         rating = COALESCE($10::numeric, rating), popular = COALESCE($11, popular), updated_at = now()
       WHERE id = $1
       RETURNING id, name, description, category, provider, price::text AS price, free_price::text AS free_price,
                 currency, commission_pct::text AS commission_pct, image_color, rating::text AS rating, popular, created_at`,
      req.productId, req.name ?? null, req.description ?? null, req.category ?? null, req.provider ?? null,
      req.price?.toFixed(2) ?? null, req.freePrice?.toFixed(2) ?? null, req.commissionPct?.toFixed(4) ?? null,
      req.imageColor ?? null, req.rating?.toFixed(2) ?? null, req.popular ?? null,
    );
    if (!row) throw new Error("product_not_found");
    return { product: marketplaceProduct(row) };
  },
);

export const deleteMarketplaceProduct = api<{ productId: string }, { success: true }>(
  { method: "DELETE", path: "/admin/marketplace/products/:productId", expose: true },
  async (req) => {
    await requireAdminAccess();
    await commerceDb.rawExec("DELETE FROM marketplace_products WHERE id = $1", req.productId);
    return { success: true };
  },
);

function marketplaceProduct(row: MarketplaceProductRow): MarketplaceProductResponse {
  return {
    id: row.id, name: row.name, description: row.description, category: row.category, provider: row.provider,
    price: Number(row.price), freePrice: Number(row.free_price), currency: row.currency,
    commissionPct: Number(row.commission_pct), imageColor: row.image_color, rating: Number(row.rating),
    popular: row.popular, createdAt: row.created_at,
  };
}

type RootsBankShareResponse = {
  id: string;
  profileId: string;
  category: string;
  sharePrice: number;
  membershipFee: number;
  totalAmount: number;
  paymentRef: string;
  pioneerPool: boolean;
  status: string;
  createdAt: string;
};

export const rootsBank = api<
  { profileId: string },
  { pioneerCount: number; myShare: RootsBankShareResponse | null }
>(
  { method: "GET", path: "/rootsbank/:profileId", expose: true },
  async (req) => {
    await requireProfileAccess(req.profileId);
    const count = await commerceDb.rawQueryRow<{ count: string }>("SELECT COUNT(*)::text AS count FROM roots_bank_shares");
    const share = await commerceDb.rawQueryRow<{
      id: string; profile_id: string; category: string; share_price: string; membership_fee: string;
      total_amount: string; payment_ref: string; pioneer_pool: boolean; status: string; created_at: string;
    }>(
      `SELECT id, profile_id, category, share_price::text AS share_price, membership_fee::text AS membership_fee,
              total_amount::text AS total_amount, payment_ref, pioneer_pool, status, created_at
       FROM roots_bank_shares WHERE profile_id = $1`,
      req.profileId,
    );
    return { pioneerCount: Number(count?.count ?? 0), myShare: share ? rootsBankShare(share) : null };
  },
);

export const purchaseRootsBankShare = api<
  { profileId: string; category: "KIDS_STUDENT" | "ADULT" | "PENSIONER"; paymentRef?: string },
  { rootsBankShare: RootsBankShareResponse; pioneerCount: number; pioneerRemaining: number; operationId: string; status: string }
>(
  { method: "POST", path: "/rootsbank/purchase", expose: true },
  async (req) => {
    const session = await requireProfileAccess(req.profileId);
    const idempotencyKey = requireIdempotencyKey();
    const membershipFee = req.category === "ADULT" ? 200 : 50;
    const sharePrice = 500;
    const totalAmount = sharePrice + membershipFee;
    const started = await beginOperation<{
      rootsBankShare: RootsBankShareResponse; pioneerCount: number; pioneerRemaining: number; operationId: string; status: string;
    }>({ operationType: "roots_bank_purchase", actorUserId: session.user.id, profileId: req.profileId, idempotencyKey, payload: req });
    if (started.operation.state === "completed" && started.operation.result) return started.operation.result;
    const operation = started.operation;
    try {
      const existingOwner = await commerceDb.rawQueryRow<{ id: string; operation_id: string | null }>(
        "SELECT id, operation_id FROM roots_bank_shares WHERE profile_id = $1", req.profileId);
      if (existingOwner && existingOwner.operation_id !== operation.id) throw APIError.alreadyExists("Member already owns a Roots Bank pioneer share");
      await placeWalletHold(operation, req.profileId, "ZAR", totalAmount.toFixed(2));
      await recordStep(operation, "hold_wallet_funds", "completed", { amount: totalAmount, currency: "ZAR" });
      let row = await commerceDb.rawQueryRow<{
        id: string; profile_id: string; category: string; share_price: string; membership_fee: string;
        total_amount: string; payment_ref: string; pioneer_pool: boolean; status: string; created_at: string;
      }>(`SELECT id, profile_id, category, share_price::text AS share_price, membership_fee::text AS membership_fee,
              total_amount::text AS total_amount, payment_ref, pioneer_pool, status, created_at
          FROM roots_bank_shares WHERE operation_id = $1`, operation.id);
      if (!row) {
        const id = crypto.randomUUID();
        const paymentRef = req.paymentRef ?? `RBS-${crypto.randomUUID().toUpperCase()}`;
        row = await commerceDb.rawQueryRow(`INSERT INTO roots_bank_shares
          (id, profile_id, category, share_price, membership_fee, total_amount, payment_ref, status, operation_id)
          VALUES ($1, $2, $3, $4::numeric, $5::numeric, $6::numeric, $7, 'PROCESSING', $8)
          RETURNING id, profile_id, category, share_price::text AS share_price, membership_fee::text AS membership_fee,
                    total_amount::text AS total_amount, payment_ref, pioneer_pool, status, created_at`,
          id, req.profileId, req.category, sharePrice.toFixed(2), membershipFee.toFixed(2), totalAmount.toFixed(2), paymentRef, operation.id);
      }
      if (!row) throw new Error("roots_bank_purchase_failed");
      await recordStep(operation, "create_pioneer_share", "completed", { rootsBankShareId: row.id });
      await captureWalletHold(operation, "roots_bank", "Roots Bank pioneer share");
      await commerceDb.rawExec("UPDATE roots_bank_shares SET status = 'REGISTERED' WHERE id = $1", row.id);
      row.status = "REGISTERED";
      await recordStep(operation, "capture_wallet_funds", "completed", { rootsBankShareId: row.id });
      const count = await commerceDb.rawQueryRow<{ count: string }>("SELECT COUNT(*)::text AS count FROM roots_bank_shares WHERE status = 'REGISTERED'");
      const pioneerCount = Number(count?.count ?? 0);
      return completeOperation(operation, { rootsBankShare: rootsBankShare(row), pioneerCount, pioneerRemaining: Math.max(0, 200 - pioneerCount), operationId: operation.id, status: "completed" });
    } catch (error) {
      try { await releaseWalletHold(operation.id); } catch { /* captured funds require reconciliation, not release */ }
      return failOperation(operation, error);
    }
  },
);

export const adminRootsBank = api<void, { pioneers: RootsBankShareResponse[] }>(
  { method: "GET", path: "/admin/rootsbank", expose: true },
  async () => {
    await requireAdminAccess();
    const rows = await commerceDb.rawQueryAll<{
      id: string; profile_id: string; category: string; share_price: string; membership_fee: string;
      total_amount: string; payment_ref: string; pioneer_pool: boolean; status: string; created_at: string;
    }>(
      `SELECT id, profile_id, category, share_price::text AS share_price, membership_fee::text AS membership_fee,
              total_amount::text AS total_amount, payment_ref, pioneer_pool, status, created_at
       FROM roots_bank_shares ORDER BY created_at`,
    );
    return { pioneers: rows.map(rootsBankShare) };
  },
);

function rootsBankShare(row: {
  id: string; profile_id: string; category: string; share_price: string; membership_fee: string;
  total_amount: string; payment_ref: string; pioneer_pool: boolean; status: string; created_at: string;
}): RootsBankShareResponse {
  return {
    id: row.id, profileId: row.profile_id, category: row.category, sharePrice: Number(row.share_price),
    membershipFee: Number(row.membership_fee), totalAmount: Number(row.total_amount), paymentRef: row.payment_ref,
    pioneerPool: row.pioneer_pool, status: row.status, createdAt: row.created_at,
  };
}

type MallTransactionResponse = {
  id: string; nfcTagId: string; storeName: string; amount: number; costOfSale: number;
  vat: number; sharePool: number; kasiPool: number; status: string; createdAt: string;
};

type SiloResponse = { id: string; name: string; percentage: number; description: string | null; color: string; sortOrder: number; updatedAt: string };

export const mall = api<{ profileId: string }, { transactions: MallTransactionResponse[]; silos: SiloResponse[]; memberCount: number }>(
  { method: "GET", path: "/mall/:profileId", expose: true },
  async (req) => {
    await requireProfileAccess(req.profileId);
    const transactions = await mallTransactions(req.profileId, 20);
    const silos = await commerceDb.rawQueryAll<{ id: string; name: string; percentage: string; description: string | null; color: string; sort_order: number; updated_at: string }>(
      "SELECT id, name, percentage::text AS percentage, description, color, sort_order, updated_at FROM silo_config ORDER BY sort_order",
    );
    const members = await identityDb.rawQueryRow<{ count: string }>("SELECT COUNT(*)::text AS count FROM profiles");
    return { transactions, silos: silos.map(siloResponse), memberCount: Number(members?.count ?? 0) };
  },
);

export const adminMall = api<{ limit?: number }, { transactions: MallTransactionResponse[]; silos: SiloResponse[]; memberCount: number }>(
  { method: "GET", path: "/admin/mall", expose: true },
  async (req) => {
    await requireAdminAccess();
    const transactions = await mallTransactions(null, Math.min(Math.max(req.limit ?? 100, 1), 500));
    const silos = await commerceDb.rawQueryAll<{ id: string; name: string; percentage: string; description: string | null; color: string; sort_order: number; updated_at: string }>(
      "SELECT id, name, percentage::text AS percentage, description, color, sort_order, updated_at FROM silo_config ORDER BY sort_order",
    );
    const members = await identityDb.rawQueryRow<{ count: string }>("SELECT COUNT(*)::text AS count FROM profiles");
    return { transactions, silos: silos.map(siloResponse), memberCount: Number(members?.count ?? 0) };
  },
);

export const updateSilos = api<
  { silos: { id: string; percentage: number; name?: string; description?: string }[] },
  { silos: SiloResponse[]; total: number }
>(
  { method: "PATCH", path: "/admin/mall/silos", expose: true },
  async (req) => {
    await requireAdminAccess();
    const total = req.silos.reduce((sum, silo) => sum + silo.percentage, 0);
    if (Math.abs(total - 100) > 0.01) throw new Error("silo_total_must_equal_100");
    for (const silo of req.silos) {
      await commerceDb.rawExec(
        `UPDATE silo_config SET percentage = $2::numeric, name = COALESCE($3, name),
                description = COALESCE($4, description), updated_at = now() WHERE id = $1`,
        silo.id, silo.percentage.toFixed(4), silo.name ?? null, silo.description ?? null,
      );
    }
    const rows = await commerceDb.rawQueryAll<{ id: string; name: string; percentage: string; description: string | null; color: string; sort_order: number; updated_at: string }>(
      "SELECT id, name, percentage::text AS percentage, description, color, sort_order, updated_at FROM silo_config ORDER BY sort_order",
    );
    return { silos: rows.map(siloResponse), total };
  },
);

async function mallTransactions(profileId: string | null, limit: number): Promise<MallTransactionResponse[]> {
  const rows = await commerceDb.rawQueryAll<{
    id: string; nfc_tag_id: string; store_name: string; amount: string; cost_of_sale: string;
    vat: string; share_pool: string; kasi_pool: string; status: string; created_at: string;
  }>(
    `SELECT id, nfc_tag_id, store_name, amount::text AS amount, cost_of_sale::text AS cost_of_sale,
            vat::text AS vat, share_pool::text AS share_pool, kasi_pool::text AS kasi_pool, status, created_at
     FROM mall_transactions WHERE ($1::uuid IS NULL OR profile_id = $1::uuid) ORDER BY created_at DESC LIMIT $2`,
    profileId, limit,
  );
  return rows.map((row) => ({
    id: row.id, nfcTagId: row.nfc_tag_id, storeName: row.store_name, amount: Number(row.amount),
    costOfSale: Number(row.cost_of_sale), vat: Number(row.vat), sharePool: Number(row.share_pool),
    kasiPool: Number(row.kasi_pool), status: row.status, createdAt: row.created_at,
  }));
}

function siloResponse(row: { id: string; name: string; percentage: string; description: string | null; color: string; sort_order: number; updated_at: string }): SiloResponse {
  return { id: row.id, name: row.name, percentage: Number(row.percentage), description: row.description, color: row.color, sortOrder: row.sort_order, updatedAt: row.updated_at };
}

type ReferralResponse = {
  id: string; referrerId: string; referredId: string | null; referralCode: string; referredName: string;
  referredEmail: string; referredMobile: string; status: string; rewardAmount: number; createdAt: string; convertedAt: string | null;
};

export const referrals = api<{ profileId: string }, { referrals: ReferralResponse[] }>(
  { method: "GET", path: "/referrals/:profileId", expose: true },
  async (req) => {
    await requireProfileAccess(req.profileId);
    const rows = await engagementDb.rawQueryAll<{
      id: string; referrer_profile_id: string; referred_profile_id: string | null; referral_code: string;
      referred_name: string; referred_email: string; referred_mobile: string; status: string;
      reward_amount: string; created_at: string; converted_at: string | null;
    }>(
      `SELECT id, referrer_profile_id, referred_profile_id, referral_code, referred_name, referred_email,
              referred_mobile, status, reward_amount::text AS reward_amount, created_at, converted_at
       FROM referrals WHERE referrer_profile_id = $1 ORDER BY created_at DESC`,
      req.profileId,
    );
    return { referrals: rows.map(referralResponse) };
  },
);

export const createReferral = api<
  { profileId: string; referredName: string; referredEmail: string; referredMobile: string },
  { referral: ReferralResponse; message: string }
>(
  { method: "POST", path: "/referrals", expose: true },
  async (req) => {
    await requireProfileAccess(req.profileId);
    const id = crypto.randomUUID();
    const code = `REF-${crypto.randomUUID().toUpperCase()}`;
    const row = await engagementDb.rawQueryRow<{
      id: string; referrer_profile_id: string; referred_profile_id: string | null; referral_code: string;
      referred_name: string; referred_email: string; referred_mobile: string; status: string;
      reward_amount: string; created_at: string; converted_at: string | null;
    }>(
      `INSERT INTO referrals (id, referrer_profile_id, referral_code, referred_name, referred_email, referred_mobile)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, referrer_profile_id, referred_profile_id, referral_code, referred_name, referred_email,
                 referred_mobile, status, reward_amount::text AS reward_amount, created_at, converted_at`,
      id, req.profileId, code, req.referredName, req.referredEmail, req.referredMobile,
    );
    if (!row) throw new Error("referral_create_failed");
    await engagementDb.rawExec(
      `INSERT INTO notification_outbox (profile_id, channel, notification_type, payload)
       VALUES ($1, 'WHATSAPP', 'referral_invitation', $2::jsonb)`,
      req.profileId,
      JSON.stringify({ referralCode: code, name: req.referredName, mobile: req.referredMobile, email: req.referredEmail }),
    );
    return { referral: referralResponse(row), message: "Referral created and invitation queued for delivery." };
  },
);

export const adminReferrals = api<void, { referrals: ReferralResponse[] }>(
  { method: "GET", path: "/admin/referrals", expose: true },
  async () => {
    await requireAdminAccess();
    const rows = await engagementDb.rawQueryAll<{
      id: string; referrer_profile_id: string; referred_profile_id: string | null; referral_code: string;
      referred_name: string; referred_email: string; referred_mobile: string; status: string;
      reward_amount: string; created_at: string; converted_at: string | null;
    }>(
      `SELECT id, referrer_profile_id, referred_profile_id, referral_code, referred_name, referred_email,
              referred_mobile, status, reward_amount::text AS reward_amount, created_at, converted_at
       FROM referrals ORDER BY created_at DESC`,
    );
    return { referrals: rows.map(referralResponse) };
  },
);

function referralResponse(row: {
  id: string; referrer_profile_id: string; referred_profile_id: string | null; referral_code: string;
  referred_name: string; referred_email: string; referred_mobile: string; status: string;
  reward_amount: string; created_at: string; converted_at: string | null;
}): ReferralResponse {
  return { id: row.id, referrerId: row.referrer_profile_id, referredId: row.referred_profile_id, referralCode: row.referral_code, referredName: row.referred_name, referredEmail: row.referred_email, referredMobile: row.referred_mobile, status: row.status, rewardAmount: Number(row.reward_amount), createdAt: row.created_at, convertedAt: row.converted_at };
}

type VoucherResponse = {
  id: string; memberId: string; code: string; title: string; description: string; provider: string; value: number;
  category: string; status: string; issueDate: string; expiryDate: string; anniversaryDate: string | null;
  wablastSent: boolean; expiringSent: boolean; createdAt: string;
};

export const vouchers = api<{ profileId: string }, { vouchers: VoucherResponse[] }>(
  { method: "GET", path: "/vouchers/:profileId", expose: true },
  async (req) => {
    await requireProfileAccess(req.profileId);
    return { vouchers: await voucherRows(req.profileId) };
  },
);

export const adminVouchers = api<void, { vouchers: VoucherResponse[] }>(
  { method: "GET", path: "/admin/vouchers", expose: true },
  async () => {
    await requireAdminAccess();
    return { vouchers: await voucherRows(null) };
  },
);

// WhatsApp voucher delivery — Author: Klaasvaakie ( |╲ )
type WhatsAppStatusResponse = {
  verified: boolean;
  phone: string | null;
  verifiedAt: string | null;
  pendingVerificationExpiresAt: string | null;
};

export const whatsappStatus = api<{ profileId: string }, WhatsAppStatusResponse>(
  { method: "GET", path: "/whatsapp/:profileId/status", expose: true },
  async (req) => {
    await requireProfileAccess(req.profileId);
    const contact = await engagementDb.rawQueryRow<{ phone_e164: string; verified_at: string }>(
      "SELECT phone_e164, verified_at FROM whatsapp_contacts WHERE profile_id = $1",
      req.profileId,
    );
    const pending = await engagementDb.rawQueryRow<{ phone_e164: string; expires_at: string }>(
      `SELECT phone_e164, expires_at FROM whatsapp_verification_codes
       WHERE profile_id = $1 AND consumed_at IS NULL AND expires_at > now() AND attempts < 5
       ORDER BY created_at DESC LIMIT 1`,
      req.profileId,
    );
    return {
      verified: Boolean(contact),
      phone: contact?.phone_e164 ?? pending?.phone_e164 ?? null,
      verifiedAt: contact?.verified_at ?? null,
      pendingVerificationExpiresAt: pending?.expires_at ?? null,
    };
  },
);

export const requestWhatsAppVerification = api<
  { profileId: string; phone: string },
  { requested: true; expiresAt: string; message: string }
>(
  { method: "POST", path: "/whatsapp/:profileId/verification/request", expose: true },
  async (req) => {
    await requireProfileAccess(req.profileId);
    const phone = normalizeWhatsAppNumber(req.phone);
    const recent = await engagementDb.rawQueryRow<{ expires_at: string }>(
      `SELECT expires_at FROM whatsapp_verification_codes
       WHERE profile_id = $1 AND phone_e164 = $2 AND created_at > now() - interval '60 seconds'
       ORDER BY created_at DESC LIMIT 1`,
      req.profileId, phone,
    );
    if (recent) {
      return { requested: true, expiresAt: recent.expires_at, message: "A verification code was already queued. Please wait before requesting another." };
    }
    const id = crypto.randomUUID();
    const code = String(randomBytes(4).readUInt32BE(0) % 1_000_000).padStart(6, "0");
    const salt = randomBytes(16).toString("hex");
    const codeHash = verificationCodeHash(salt, code);
    const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();
    await engagementDb.rawExec(
      `INSERT INTO whatsapp_verification_codes (id, profile_id, phone_e164, code_salt, code_hash, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6::timestamptz)`,
      id, req.profileId, phone, salt, codeHash, expiresAt,
    );
    await engagementDb.rawExec(
      `INSERT INTO notification_outbox
         (profile_id, channel, notification_type, destination, dedupe_key, payload)
       VALUES ($1, 'WHATSAPP', 'whatsapp_verification', $2, $3, (($4::jsonb) #>> '{}')::jsonb)
       ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING`,
      req.profileId, phone, `whatsapp_verification:${id}`,
      JSON.stringify({ verificationId: id, code, expiresAt, message: `Your KaSiHub WhatsApp verification code is ${code}. It expires in 10 minutes.` }),
    );
    return { requested: true, expiresAt, message: "Verification code queued for your WhatsApp number." };
  },
);

export const confirmWhatsAppVerification = api<
  { profileId: string; code: string },
  { verified: true; phone: string; activeVouchersQueued: number; message: string }
>(
  { method: "POST", path: "/whatsapp/:profileId/verification/confirm", expose: true },
  async (req) => {
    await requireProfileAccess(req.profileId);
    if (!/^\d{6}$/.test(req.code)) throw APIError.invalidArgument("Enter the six-digit verification code.");
    const verification = await engagementDb.rawQueryRow<{
      id: string; phone_e164: string; code_salt: string; code_hash: string; attempts: number;
    }>(
      `SELECT id, phone_e164, code_salt, code_hash, attempts FROM whatsapp_verification_codes
       WHERE profile_id = $1 AND consumed_at IS NULL AND expires_at > now() AND attempts < 5
       ORDER BY created_at DESC LIMIT 1`,
      req.profileId,
    );
    if (!verification) throw APIError.failedPrecondition("No valid verification request exists. Request a new code.");
    const suppliedHash = verificationCodeHash(verification.code_salt, req.code);
    const valid = timingSafeEqual(Buffer.from(suppliedHash, "hex"), Buffer.from(verification.code_hash, "hex"));
    if (!valid) {
      await engagementDb.rawExec("UPDATE whatsapp_verification_codes SET attempts = attempts + 1 WHERE id = $1", verification.id);
      throw APIError.permissionDenied("The verification code is incorrect.");
    }
    const transaction = await engagementDb.begin();
    try {
      await transaction.rawExec(
        "UPDATE whatsapp_verification_codes SET consumed_at = now() WHERE id = $1",
        verification.id,
      );
      await transaction.rawExec(
        `INSERT INTO whatsapp_contacts (profile_id, phone_e164, verified_at)
         VALUES ($1, $2, now())
         ON CONFLICT (profile_id) DO UPDATE SET phone_e164 = EXCLUDED.phone_e164, verified_at = now(), updated_at = now();`,
        req.profileId, verification.phone_e164,
      );
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
    const queued = await queueVoucherNotifications(req.profileId, "active", verification.phone_e164);
    await engagementDb.rawExec(
      "UPDATE whatsapp_contacts SET active_vouchers_queued_at = now(), updated_at = now() WHERE profile_id = $1",
      req.profileId,
    );
    return {
      verified: true,
      phone: verification.phone_e164,
      activeVouchersQueued: queued.queued,
      message: queued.queued > 0
        ? `WhatsApp verified. ${queued.queued} active voucher(s) were queued automatically.`
        : "WhatsApp verified. There are no undelivered active vouchers right now.",
    };
  },
);

export const queueVoucherDelivery = api<
  { profileId: string; mode: "active" | "expiring" },
  { pushed: number; queued: number; vouchers: { code: string; title: string; value: number; expiryDate: string }[]; message: string }
>(
  { method: "POST", path: "/vouchers/:profileId/delivery", expose: true },
  async (req) => {
    await requireProfileAccess(req.profileId);
    const contact = await engagementDb.rawQueryRow<{ phone_e164: string }>(
      "SELECT phone_e164 FROM whatsapp_contacts WHERE profile_id = $1",
      req.profileId,
    );
    if (!contact) throw APIError.failedPrecondition("Verify your WhatsApp number before sending vouchers.");
    return queueVoucherNotifications(req.profileId, req.mode, contact.phone_e164);
  },
);

async function queueVoucherNotifications(profileId: string, mode: "active" | "expiring", destination: string) {
  const rows = await engagementDb.rawQueryAll<{ id: string; code: string; title: string; value: string; expiry_date: string }>(
    mode === "expiring"
      ? `SELECT id, code, title, value::text AS value, expiry_date FROM vouchers
         WHERE profile_id = $1 AND status = 'ACTIVE' AND expiring_sent = false
           AND anniversary_date > now() AND anniversary_date <= now() + interval '5 days'`
      : `SELECT id, code, title, value::text AS value, expiry_date FROM vouchers
         WHERE profile_id = $1 AND status = 'ACTIVE' AND wablast_sent = false AND expiry_date > now()`,
    profileId,
  );
  if (rows.length === 0) return { pushed: 0, queued: 0, vouchers: [], message: "No vouchers require delivery." };
  const vouchers = rows.map((row) => ({ code: row.code, title: row.title, value: Number(row.value), expiryDate: row.expiry_date }));
  const voucherIds = rows.map((row) => row.id).sort();
  const dedupeKey = `${mode === "expiring" ? "voucher_expiry" : "voucher_active"}:${profileId}:${createHash("sha256").update(voucherIds.join(",")).digest("hex")}`;
  await engagementDb.rawExec(
    `INSERT INTO notification_outbox
       (profile_id, channel, notification_type, destination, dedupe_key, payload)
     VALUES ($1, 'WHATSAPP', $2, $3, $4, (($5::jsonb) #>> '{}')::jsonb)
     ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING`,
    profileId, mode === "expiring" ? "voucher_expiry" : "voucher_active", destination, dedupeKey,
    JSON.stringify({ vouchers, priority: mode === "expiring" ? "high" : "normal" }),
  );
  await engagementDb.rawExec(
    mode === "expiring"
      ? "UPDATE vouchers SET expiring_sent = true WHERE id = ANY($1::uuid[])"
      : "UPDATE vouchers SET wablast_sent = true WHERE id = ANY($1::uuid[])",
    voucherIds,
  );
  return { pushed: 0, queued: rows.length, vouchers, message: `${rows.length} voucher notification(s) queued for verified WhatsApp delivery.` };
}

export const queueAnniversaryVoucherReminders = api(
  {},
  processAnniversaryVoucherReminders,
);

export const runAnniversaryVoucherReminders = api<void, { profilesProcessed: number; vouchersQueued: number }>(
  { method: "POST", path: "/admin/vouchers/run-anniversary-reminders", expose: true },
  async () => {
    await requireAdminAccess();
    return processAnniversaryVoucherReminders();
  },
);

const anniversaryVoucherReminderJob = new CronJob("anniversary-voucher-reminders", {
  title: "Queue five-day WhatsApp voucher reminders",
  schedule: "0 7 * * *",
  endpoint: queueAnniversaryVoucherReminders,
});

void anniversaryVoucherReminderJob;

async function processAnniversaryVoucherReminders(): Promise<{ profilesProcessed: number; vouchersQueued: number }> {
  const contacts = await engagementDb.rawQueryAll<{ profile_id: string; phone_e164: string }>(
    `SELECT DISTINCT wc.profile_id, wc.phone_e164 FROM whatsapp_contacts wc
     JOIN vouchers v ON v.profile_id = wc.profile_id
     WHERE v.status = 'ACTIVE' AND v.expiring_sent = false
       AND v.anniversary_date > now() AND v.anniversary_date <= now() + interval '5 days'`,
  );
  let vouchersQueued = 0;
  for (const contact of contacts) {
    const result = await queueVoucherNotifications(contact.profile_id, "expiring", contact.phone_e164);
    vouchersQueued += result.queued;
  }
  return { profilesProcessed: contacts.length, vouchersQueued };
}

function normalizeWhatsAppNumber(value: string): string {
  const compact = value.trim().replace(/[\s().-]/g, "");
  const normalized = compact.startsWith("0") ? `+27${compact.slice(1)}` : compact.startsWith("+") ? compact : `+${compact}`;
  if (!/^\+[1-9]\d{7,14}$/.test(normalized)) throw APIError.invalidArgument("Enter a valid WhatsApp number including its country code.");
  return normalized;
}

function verificationCodeHash(salt: string, code: string): string {
  return createHash("sha256").update(`${salt}:${code}`).digest("hex");
}

async function voucherRows(profileId: string | null): Promise<VoucherResponse[]> {
  const rows = await engagementDb.rawQueryAll<{
    id: string; profile_id: string; code: string; title: string; description: string; provider: string; value: string;
    category: string; status: string; issue_date: string; expiry_date: string; anniversary_date: string | null;
    wablast_sent: boolean; expiring_sent: boolean; created_at: string;
  }>(
    `SELECT id, profile_id, code, title, description, provider, value::text AS value, category, status,
            issue_date, expiry_date, anniversary_date, wablast_sent, expiring_sent, created_at
     FROM vouchers WHERE ($1::uuid IS NULL OR profile_id = $1::uuid) ORDER BY expiry_date`,
    profileId,
  );
  return rows.map((row) => ({ id: row.id, memberId: row.profile_id, code: row.code, title: row.title, description: row.description, provider: row.provider, value: Number(row.value), category: row.category, status: row.status, issueDate: row.issue_date, expiryDate: row.expiry_date, anniversaryDate: row.anniversary_date, wablastSent: row.wablast_sent, expiringSent: row.expiring_sent, createdAt: row.created_at }));
}

type SubscriptionNotificationResponse = {
  id: string; memberId: string; daysBefore: number; channel: string; status: string; message: string; sentAt: string;
};

export const subscriptionNotifications = api<{ profileId: string }, { notifications: SubscriptionNotificationResponse[] }>(
  { method: "GET", path: "/subscriptions/:profileId/notifications", expose: true },
  async (req) => {
    await requireProfileAccess(req.profileId);
    return { notifications: await notificationRows(req.profileId) };
  },
);

export const queueSubscriptionNotification = api<
  { profileId: string; daysBefore: 1 | 3 | 5 },
  { queued: boolean; notification: SubscriptionNotificationResponse | null }
>(
  { method: "POST", path: "/subscriptions/:profileId/notifications", expose: true },
  async (req) => {
    await requireProfileAccess(req.profileId);
    return queueRenewalNotification(req.profileId, req.daysBefore);
  },
);

export const adminSubscriptionNotifications = api<void, { notifications: SubscriptionNotificationResponse[]; activeMembers: number }>(
  { method: "GET", path: "/admin/subscription-notifications", expose: true },
  async () => {
    await requireAdminAccess();
    const active = await membershipDb.rawQueryRow<{ count: string }>("SELECT COUNT(DISTINCT profile_id)::text AS count FROM subscriptions WHERE status = 'active'");
    return { notifications: await notificationRows(null), activeMembers: Number(active?.count ?? 0) };
  },
);

export const adminQueueSubscriptionNotifications = api<
  { daysBefore: 1 | 3 | 5 },
  { sent: number; totalEligible: number; daysBefore: number; message: string }
>(
  { method: "POST", path: "/admin/subscription-notifications", expose: true },
  async (req) => {
    await requireAdminAccess();
    const profiles = await membershipDb.rawQueryAll<{ profile_id: string }>("SELECT DISTINCT profile_id FROM subscriptions WHERE status = 'active'");
    let queued = 0;
    for (const profile of profiles) {
      const result = await queueRenewalNotification(profile.profile_id, req.daysBefore);
      if (result.queued) queued++;
    }
    return { sent: 0, totalEligible: profiles.length, daysBefore: req.daysBefore, message: `${queued} renewal reminder(s) queued for delivery.` };
  },
);

async function queueRenewalNotification(profileId: string, daysBefore: 1 | 3 | 5): Promise<{ queued: boolean; notification: SubscriptionNotificationResponse | null }> {
  const subscription = await membershipDb.rawQueryRow<{ billing_period: string }>(
    `SELECT COALESCE(to_char(current_period_end, 'YYYY-MM'), to_char(starts_at, 'YYYY-MM')) AS billing_period
     FROM subscriptions WHERE profile_id = $1 ORDER BY starts_at DESC LIMIT 1`, profileId,
  );
  if (!subscription) throw new Error("subscription_not_found");
  const message = daysBefore === 1
    ? "URGENT: Your KaSiHUB subscription renews tomorrow. Please fund your payment account."
    : `Your KaSiHUB subscription renews in ${daysBefore} days. Please ensure your payment account is funded.`;
  const id = crypto.randomUUID();
  const row = await engagementDb.rawQueryRow<{
    id: string; profile_id: string; days_before: number; channel: string; status: string; message: string; sent_at: string;
  }>(
    `INSERT INTO subscription_notifications (id, profile_id, days_before, billing_period, message)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (profile_id, days_before, billing_period) DO NOTHING
     RETURNING id, profile_id, days_before, channel, status, message, sent_at`,
    id, profileId, daysBefore, subscription.billing_period, message,
  );
  if (!row) return { queued: false, notification: null };
  await engagementDb.rawExec(
    `INSERT INTO notification_outbox (profile_id, channel, notification_type, payload)
     VALUES ($1, 'WHATSAPP', 'subscription_renewal', $2::jsonb)`,
    profileId, JSON.stringify({ daysBefore, message, notificationId: id }),
  );
  return { queued: true, notification: notificationResponse(row) };
}

async function notificationRows(profileId: string | null): Promise<SubscriptionNotificationResponse[]> {
  const rows = await engagementDb.rawQueryAll<{
    id: string; profile_id: string; days_before: number; channel: string; status: string; message: string; sent_at: string;
  }>(
    `SELECT id, profile_id, days_before, channel, status, message, sent_at
     FROM subscription_notifications WHERE ($1::uuid IS NULL OR profile_id = $1::uuid)
     ORDER BY sent_at DESC LIMIT 200`, profileId,
  );
  return rows.map(notificationResponse);
}

function notificationResponse(row: { id: string; profile_id: string; days_before: number; channel: string; status: string; message: string; sent_at: string }): SubscriptionNotificationResponse {
  return { id: row.id, memberId: row.profile_id, daysBefore: row.days_before, channel: row.channel, status: row.status, message: row.message, sentAt: row.sent_at };
}

type PoolDistributionResponse = { id: string; memberId: string; amount: number; source: string; poolType: string; status: string; payoutDate: string };

export const declareDividend = api<
  { amount: number },
  { declaration: { id: string; amount: number; totalShares: number; perShareAmount: number; status: string; declaredAt: string; paidAt: string | null }; distributedTo: number; totalShares: number; perShareAmount: number; operationId: string; status: string }
>(
  { method: "POST", path: "/admin/dividends", expose: true },
  async (req) => {
    const admin = await requireAdminAccess();
    const idempotencyKey = requireIdempotencyKey();
    if (!(req.amount > 0)) throw new Error("positive_amount_required");
    const started = await beginOperation<{
      declaration: { id: string; amount: number; totalShares: number; perShareAmount: number; status: string; declaredAt: string; paidAt: string | null };
      distributedTo: number; totalShares: number; perShareAmount: number; operationId: string; status: string;
    }>({ operationType: "dividend_distribution", actorUserId: admin.user.id, idempotencyKey, payload: req });
    if (started.operation.state === "completed" && started.operation.result) return started.operation.result;
    const operation = started.operation;
    try {
      let allocations = await financeDb.rawQueryAll<{ profile_id: string; amount: string; weight: string }>(
        "SELECT profile_id, amount::text AS amount, weight::text AS weight FROM distribution_allocations WHERE operation_id = $1 ORDER BY profile_id", operation.id);
      let declaration = await financeDb.rawQueryRow<{ id: string; amount: string; total_shares: number; per_share_amount: string; declared_at: string; paid_at: string | null }>(
        "SELECT id, amount::text AS amount, total_shares, per_share_amount::text AS per_share_amount, declared_at, paid_at FROM dividend_declarations WHERE operation_id = $1", operation.id);
      if (!declaration || allocations.length === 0) {
        const holdings = await sharesDb.rawQueryAll<{ profile_id: string; total_shares: string }>(
          `SELECT profile_id, SUM(total_shares)::text AS total_shares FROM share_certificates
           WHERE status <> 'revoked' GROUP BY profile_id ORDER BY profile_id`);
        const eligible: { profileId: string; weight: number }[] = [];
        for (const holding of holdings) {
          const subscription = await membershipDb.rawQueryRow<{ status: string }>(
            "SELECT status FROM subscriptions WHERE profile_id = $1 ORDER BY starts_at DESC LIMIT 1", holding.profile_id);
          if (subscription?.status === "active") eligible.push({ profileId: holding.profile_id, weight: Number(holding.total_shares) });
        }
        const totalShares = eligible.reduce((sum, item) => sum + item.weight, 0);
        if (totalShares <= 0) throw APIError.failedPrecondition("No active members hold eligible shares");
        const calculated = allocateWeightedCents(Math.round(req.amount * 100), eligible);
        const declarationId = crypto.randomUUID();
        const perShareAmount = req.amount / totalShares;
        const tx = await financeDb.begin();
        try {
          await tx.rawExec(`INSERT INTO dividend_declarations (id, amount, total_shares, per_share_amount, operation_id)
             VALUES ($1, $2::numeric, $3, $4::numeric, $5) ON CONFLICT (operation_id) WHERE operation_id IS NOT NULL DO NOTHING`,
            declarationId, req.amount.toFixed(2), totalShares, perShareAmount.toFixed(4), operation.id);
          for (const item of calculated) {
            await tx.rawExec(`INSERT INTO distribution_allocations (operation_id, profile_id, amount, weight)
               VALUES ($1, $2, $3::numeric, $4::numeric) ON CONFLICT (operation_id, profile_id) DO NOTHING`,
              operation.id, item.profileId, (item.cents / 100).toFixed(2), item.weight.toFixed(4));
          }
          await tx.commit();
        } catch (error) { await tx.rollback(); throw error; }
        allocations = await financeDb.rawQueryAll("SELECT profile_id, amount::text AS amount, weight::text AS weight FROM distribution_allocations WHERE operation_id = $1 ORDER BY profile_id", operation.id);
        declaration = await financeDb.rawQueryRow("SELECT id, amount::text AS amount, total_shares, per_share_amount::text AS per_share_amount, declared_at, paid_at FROM dividend_declarations WHERE operation_id = $1", operation.id);
      }
      if (!declaration) throw new Error("dividend_declaration_not_created");
      await recordStep(operation, "snapshot_allocations", "completed", { recipients: allocations.length, totalShares: declaration.total_shares });
      for (const allocation of allocations) {
        if (Number(allocation.amount) <= 0) continue;
        await creditWorkflowDistribution({ operation, profileId: allocation.profile_id, amount: allocation.amount, source: "DIVIDEND", poolType: "SHAREHOLDERS" });
      }
      await financeDb.rawExec("UPDATE dividend_declarations SET status = 'paid', paid_at = COALESCE(paid_at, now()) WHERE id = $1", declaration.id);
      await recordStep(operation, "credit_recipients", "completed", { recipients: allocations.length });
      const paidAt = new Date().toISOString();
      const result = {
        declaration: { id: declaration.id, amount: Number(declaration.amount), totalShares: declaration.total_shares, perShareAmount: Number(declaration.per_share_amount), status: "PAID", declaredAt: declaration.declared_at, paidAt },
        distributedTo: allocations.filter((item) => Number(item.amount) > 0).length,
        totalShares: declaration.total_shares,
        perShareAmount: Number(declaration.per_share_amount),
        operationId: operation.id,
        status: "completed",
      };
      return completeOperation(operation, result);
    } catch (error) { return failOperation(operation, error); }
  },
);

export const adminDividends = api<void, { dividends: { id: string; amount: number; totalShares: number; perShareAmount: number; status: string; declaredAt: string; paidAt: string | null }[] }>(
  { method: "GET", path: "/admin/dividends", expose: true },
  async () => {
    await requireAdminAccess();
    const rows = await financeDb.rawQueryAll<{ id: string; amount: string; total_shares: number; per_share_amount: string; status: string; declared_at: string; paid_at: string | null }>(
      "SELECT id, amount::text AS amount, total_shares, per_share_amount::text AS per_share_amount, status, declared_at, paid_at FROM dividend_declarations ORDER BY declared_at DESC",
    );
    return { dividends: rows.map((row) => ({ id: row.id, amount: Number(row.amount), totalShares: row.total_shares, perShareAmount: Number(row.per_share_amount), status: row.status.toUpperCase(), declaredAt: row.declared_at, paidAt: row.paid_at })) };
  },
);

export const poolOverview = api<{ limit?: number }, {
  distributions: PoolDistributionResponse[];
  totals: { totalIncoming: number; mallPoolIncoming: number; marketplacePoolIncoming: number; totalPaidOut: number; balance: number; distributionCount: number };
  eligibleMembers: number;
}>(
  { method: "GET", path: "/admin/pool", expose: true },
  async (req) => {
    await requireAdminAccess();
    const rows = await financeDb.rawQueryAll<{ id: string; profile_id: string; amount: string; source: string; pool_type: string; status: string; payout_date: string }>(
      `SELECT id, profile_id, amount::text AS amount, source, pool_type, status, payout_date
       FROM pool_distributions ORDER BY payout_date DESC LIMIT $1`, Math.min(Math.max(req.limit ?? 100, 1), 500),
    );
    const incoming = await commerceDb.rawQueryRow<{ mall: string; marketplace: string }>(
      `SELECT
         COALESCE((SELECT SUM(kasi_pool) FROM mall_transactions), 0)::text AS mall,
         COALESCE((SELECT SUM(commission) FROM marketplace_orders), 0)::text AS marketplace`,
    );
    const eligible = await membershipDb.rawQueryRow<{ count: string }>("SELECT COUNT(DISTINCT profile_id)::text AS count FROM subscriptions WHERE status = 'active'");
    const distributions = rows.map(poolDistributionResponse);
    const mallPoolIncoming = Number(incoming?.mall ?? 0);
    const marketplacePoolIncoming = Number(incoming?.marketplace ?? 0);
    const totalPaidOut = distributions.filter((distribution) => distribution.status === "PAID").reduce((sum, distribution) => sum + distribution.amount, 0);
    const totalIncoming = mallPoolIncoming + marketplacePoolIncoming;
    return { distributions, totals: { totalIncoming, mallPoolIncoming, marketplacePoolIncoming, totalPaidOut, balance: totalIncoming - totalPaidOut, distributionCount: distributions.length }, eligibleMembers: Number(eligible?.count ?? 0) };
  },
);

export const distributePool = api<
  { totalAmount: number; source?: string },
  { distributed: number; perMember: number; totalDistributed: number; operationId: string; status: string }
>(
  { method: "POST", path: "/admin/pool/distributions", expose: true },
  async (req) => {
    const admin = await requireAdminAccess();
    const idempotencyKey = requireIdempotencyKey();
    if (!(req.totalAmount > 0)) throw new Error("positive_amount_required");
    const started = await beginOperation<{
      distributed: number; perMember: number; totalDistributed: number; operationId: string; status: string;
    }>({ operationType: "pool_distribution", actorUserId: admin.user.id, idempotencyKey, payload: req });
    if (started.operation.state === "completed" && started.operation.result) return started.operation.result;
    const operation = started.operation;
    try {
      let allocations = await financeDb.rawQueryAll<{ profile_id: string; amount: string }>(
        "SELECT profile_id, amount::text AS amount FROM distribution_allocations WHERE operation_id = $1 ORDER BY profile_id", operation.id);
      if (allocations.length === 0) {
        const profiles = await membershipDb.rawQueryAll<{ profile_id: string }>(
          "SELECT DISTINCT profile_id FROM subscriptions WHERE status = 'active' ORDER BY profile_id");
        if (profiles.length === 0) throw APIError.failedPrecondition("No active members are eligible for distribution");
        const calculated = allocateEvenCents(Math.round(req.totalAmount * 100), profiles.map((item) => item.profile_id));
        const tx = await financeDb.begin();
        try {
          for (const item of calculated) {
            await tx.rawExec(`INSERT INTO distribution_allocations (operation_id, profile_id, amount)
               VALUES ($1, $2, $3::numeric) ON CONFLICT (operation_id, profile_id) DO NOTHING`,
              operation.id, item.profileId, (item.cents / 100).toFixed(2));
          }
          await tx.commit();
        } catch (error) { await tx.rollback(); throw error; }
        allocations = await financeDb.rawQueryAll("SELECT profile_id, amount::text AS amount FROM distribution_allocations WHERE operation_id = $1 ORDER BY profile_id", operation.id);
      }
      await recordStep(operation, "snapshot_allocations", "completed", { recipients: allocations.length, totalAmount: req.totalAmount });
      for (const allocation of allocations) {
        if (Number(allocation.amount) <= 0) continue;
        await creditWorkflowDistribution({ operation, profileId: allocation.profile_id, amount: allocation.amount, source: req.source ?? "MANUAL", poolType: "SHAREHOLDERS" });
      }
      await recordStep(operation, "credit_recipients", "completed", { recipients: allocations.length });
      const totalDistributed = Number(allocations.reduce((sum, item) => sum + Number(item.amount), 0).toFixed(2));
      return completeOperation(operation, {
        distributed: allocations.filter((item) => Number(item.amount) > 0).length,
        perMember: Number((req.totalAmount / allocations.length).toFixed(2)),
        totalDistributed,
        operationId: operation.id,
        status: "completed",
      });
    } catch (error) { return failOperation(operation, error); }
  },
);


function poolDistributionResponse(row: { id: string; profile_id: string; amount: string; source: string; pool_type: string; status: string; payout_date: string }): PoolDistributionResponse {
  return { id: row.id, memberId: row.profile_id, amount: Number(row.amount), source: row.source, poolType: row.pool_type, status: row.status.toUpperCase(), payoutDate: row.payout_date };
}

export const bootstrapMigrationAdmin = api<void, { ok: true; promoted: boolean }>(
  { method: "POST", path: "/migration/bootstrap-admin", expose: true },
  async () => {
    const session = await sessionFromBearer();
    if (!session) throw new Error("unauthenticated");
    const count = await identityDb.rawQueryRow<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM user_roles ur
       JOIN roles r ON r.id = ur.role_id WHERE r.name = 'admin'`,
    );
    if (Number(count?.count ?? 0) > 0) {
      await requireAdminAccess();
      return { ok: true, promoted: false };
    }
    await identityDb.rawExec(
      `INSERT INTO user_roles (user_id, role_id)
       SELECT $1, id FROM roles WHERE name = 'admin'
       ON CONFLICT (user_id, role_id) DO NOTHING`,
      session.user.id,
    );
    await auditDb.rawExec(
      `INSERT INTO audit_logs (action, entity_type, entity_id, after)
       VALUES ('migration.bootstrap_admin', 'user', $1, $2::jsonb)`,
      session.user.id, JSON.stringify({ email: session.user.email }),
    );
    return { ok: true, promoted: true };
  },
);

const legacyImportRequest = z.object({
  entity: z.string().min(1),
  rows: z.array(z.record(z.string(), z.unknown())).max(250),
});

export const importLegacyBatch = api<
  { entity: string; rows: Record<string, unknown>[] },
  { entity: string; imported: number }
>(
  { method: "POST", path: "/admin/migration/import", expose: true },
  async (req) => {
    await requireAdminAccess();
    const payload = legacyImportRequest.parse(req);
    let imported = 0;
    for (const row of payload.rows) {
      if (payload.entity === "Member") {
        await importLegacyMember(row);
        imported++;
        continue;
      }
      if (payload.entity === "SharePhase") await importLegacySharePhase(row);
      else if (payload.entity === "MatrixNode") await importLegacyMatrixNode(row);
      else if (payload.entity === "Subscription") await importLegacySubscription(row);
      else if (payload.entity === "Transaction") await importLegacyTransaction(row);
      else if (payload.entity === "Share") await importLegacyShare(row);
      else if (payload.entity === "AureusShare") await importLegacyAureusShare(row);
      else if (payload.entity === "DividendDeclaration") await importLegacyDividend(row);
      else if (payload.entity === "KasiPoolDistribution") await importLegacyPoolDistribution(row);
      else if (payload.entity === "MarketplaceProduct") await importLegacyMarketplaceProduct(row);
      else if (payload.entity === "MarketplaceOrder") await importLegacyMarketplaceOrder(row);
      else if (payload.entity === "MallTransaction") await importLegacyMallTransaction(row);
      else if (payload.entity === "RootsBankShare") await importLegacyRootsBankShare(row);
      else if (payload.entity === "RootsBankDuplicate") await importLegacyRootsBankDuplicate(row);
      else if (payload.entity === "Referral") await importLegacyReferral(row);
      else if (payload.entity === "Voucher") await importLegacyVoucher(row);
      else if (payload.entity === "SubscriptionNotification") await importLegacySubscriptionNotification(row);
      else if (payload.entity === "Setting") await importLegacySetting(row);
      else if (payload.entity === "SiloConfig") await importLegacySilo(row);
      else if (payload.entity === "AuditorNotification") await importLegacyAuditNotification(row);
      else if (payload.entity === "WalletBalance") await importLegacyWalletBalance(row);
      else throw new Error(`unsupported_legacy_entity:${payload.entity}`);
      imported++;
      continue;
    }
    await auditDb.rawExec(
      `INSERT INTO audit_logs (action, entity_type, entity_id, after)
       VALUES ('migration.batch_import', $1, gen_random_uuid(), $2::jsonb)`,
      payload.entity, JSON.stringify({ imported }),
    );
    return { entity: payload.entity, imported };
  },
);

async function importLegacyMember(row: Record<string, unknown>) {
  const userId = requiredString(row, "userId");
  const profileId = requiredString(row, "id");
  const email = requiredString(row, "email").toLowerCase();
  await identityDb.rawExec(
    `INSERT INTO users (id, email, password_hash, phone, status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, 'active', $5::timestamptz, $6::timestamptz)
     ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, phone = EXCLUDED.phone, updated_at = EXCLUDED.updated_at`,
    userId, email, hashPassword(requiredString(row, "password")), nullableString(row.mobile),
    requiredString(row, "createdAt"), requiredString(row, "updatedAt"),
  );
  await identityDb.rawExec(
    `INSERT INTO profiles (
       id, user_id, profile_type, unique_profile_number, membership_type, citizenship_type,
       first_name, surname, company_name, company_registration_number, id_or_passport_number,
       sars_number, country, profile_picture_url, status, address_line, city, postal_code,
       beneficiary_name, beneficiary_id, guardian_name, kyc_verified_at, tax_threshold,
       monthly_earnings, nfc_tag_id, visa_card_last4, roots_bank_account, instapay_status,
       instapay_verified_at, instapay_account_ref, upline_profile_number, upline_confirmed,
       created_at, updated_at
     ) VALUES (
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,
       $22::timestamptz,$23,$24::numeric,$25,$26,$27,$28,$29::timestamptz,$30,$31,$32,$33::timestamptz,$34::timestamptz
     )
     ON CONFLICT (id) DO UPDATE SET
       membership_type = EXCLUDED.membership_type, citizenship_type = EXCLUDED.citizenship_type,
       first_name = EXCLUDED.first_name, surname = EXCLUDED.surname, company_name = EXCLUDED.company_name,
       status = EXCLUDED.status, updated_at = EXCLUDED.updated_at`,
    profileId, userId, requiredString(row, "profileType"), requiredString(row, "profileNumber"),
    nullableString(row.membershipType), nullableString(row.citizenshipType), nullableString(row.firstName),
    nullableString(row.lastName), nullableString(row.companyName), nullableString(row.companyRegNo),
    nullableString(row.idPassport), nullableString(row.sarsNumber), nullableString(row.country) ?? "ZA",
    nullableString(row.profilePicture), requiredString(row, "profileStatus"), nullableString(row.addressLine),
    nullableString(row.city), nullableString(row.postalCode), nullableString(row.beneficiaryName),
    nullableString(row.beneficiaryId), nullableString(row.guardianName), nullableString(row.kycVerifiedAt),
    Boolean(row.taxThreshold), Number(row.monthlyEarnings ?? 0).toFixed(2), nullableString(row.nfcTagId),
    nullableString(row.visaCardLast4), nullableString(row.rootsBankAccount), nullableString(row.instapayStatus) ?? "NONE",
    nullableString(row.instapayVerifiedAt), nullableString(row.instapayAccountRef), nullableString(row.uplineProfileNumber),
    Boolean(row.uplineConfirmed), requiredString(row, "createdAt"), requiredString(row, "updatedAt"),
  );
  await identityDb.rawExec(
    `INSERT INTO user_roles (user_id, role_id)
     SELECT $1, id FROM roles WHERE name = $2
     ON CONFLICT (user_id, role_id) DO NOTHING`,
    userId, row.isAdmin ? "admin" : "member",
  );
}

async function importLegacySharePhase(row: Record<string, unknown>) {
  await sharesDb.rawExec(`INSERT INTO share_phases (id, phase_number, quantity_available, total_quantity, price_per_share, currency, status, bonus_buy_one_get, created_at, updated_at)
    VALUES ($1,$2,$3,$4,$5::numeric,'USD',$6,$7,$8::timestamptz,$9::timestamptz)
    ON CONFLICT (phase_number) DO UPDATE SET quantity_available=EXCLUDED.quantity_available,total_quantity=EXCLUDED.total_quantity,price_per_share=EXCLUDED.price_per_share,status=EXCLUDED.status,bonus_buy_one_get=EXCLUDED.bonus_buy_one_get,updated_at=EXCLUDED.updated_at`,
    requiredString(row,"id"),Number(row.phase),Number(row.totalShares)-Number(row.soldShares),Number(row.totalShares),String(row.pricePerShare),requiredString(row,"status").toLowerCase(),Boolean(row.bonusBuyOneGet),requiredString(row,"createdAt"),requiredString(row,"updatedAt"));
}

async function importLegacyMatrixNode(row: Record<string, unknown>) {
  await networkDb.rawExec(`INSERT INTO matrix_nodes (id,profile_id,parent_node_id,sponsor_profile_id,position_index,depth,path,created_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8::timestamptz) ON CONFLICT (profile_id) DO UPDATE SET parent_node_id=EXCLUDED.parent_node_id,sponsor_profile_id=EXCLUDED.sponsor_profile_id,position_index=EXCLUDED.position_index,depth=EXCLUDED.depth,path=EXCLUDED.path`,
    requiredString(row,"id"),requiredString(row,"profileId"),nullableString(row.parentNodeId),nullableString(row.sponsorProfileId),Number(row.position),Number(row.level),requiredString(row,"path"),requiredString(row,"createdAt"));
}

async function importLegacySubscription(row: Record<string, unknown>) {
  const planId=requiredString(row,"planId"); const id=requiredString(row,"id");
  await membershipDb.rawExec(`INSERT INTO membership_plans (id,code,name,member_type,currency,amount,billing_period,active) VALUES ($1,$2,$2,'legacy',$3,$4::numeric,'monthly',true) ON CONFLICT (code) DO NOTHING`,planId,requiredString(row,"planCode"),requiredString(row,"currency"),String(row.amount));
  await membershipDb.rawExec(`INSERT INTO subscriptions (id,profile_id,plan_id,status,starts_at,current_period_end) VALUES ($1,$2,$3,$4,$5::timestamptz,$6::timestamptz) ON CONFLICT (id) DO NOTHING`,id,requiredString(row,"profileId"),planId,requiredString(row,"status").toLowerCase(),requiredString(row,"createdAt"),nullableString(row.periodEnd));
  await membershipDb.rawExec(`INSERT INTO payments (id,profile_id,subscription_id,provider,provider_reference,amount,currency,status,metadata,created_at) VALUES ($1,$2,$3,$4,$5,$6::numeric,$7,$8,'{}'::jsonb,$9::timestamptz) ON CONFLICT (provider_reference) DO NOTHING`,requiredString(row,"paymentId"),requiredString(row,"profileId"),id,requiredString(row,"method"),`legacy:${id}`,String(row.amount),requiredString(row,"currency"),requiredString(row,"status").toLowerCase(),requiredString(row,"createdAt"));
}

async function importLegacyTransaction(row: Record<string, unknown>) {
  const id=requiredString(row,"id"); const existing=await financeDb.rawQueryRow<{id:string}>("SELECT id FROM ledger_transactions WHERE id=$1",id); if(existing)return;
  const profileId=requiredString(row,"profileId"); const amount=Number(row.amount); const memberAccount=requiredString(row,"memberAccountId"); const systemAccount=requiredString(row,"systemAccountId");
  await financeDb.rawExec(`INSERT INTO ledger_accounts (id,owner_type,owner_id,account_code,currency,status) VALUES ($1,'profile',$2,'wallet','ZAR','active') ON CONFLICT (id) DO NOTHING`,memberAccount,profileId);
  await financeDb.rawExec(`INSERT INTO ledger_accounts (id,owner_type,owner_id,account_code,currency,status) VALUES ($1,'system',$2,'legacy-offset','ZAR','active') ON CONFLICT (id) DO NOTHING`,systemAccount,requiredString(row,"systemOwnerId"));
  await financeDb.rawExec(`INSERT INTO ledger_transactions (id,transaction_type,reference_type,reference_id,description,created_at) VALUES ($1,$2,'legacy_transaction',$1,$3,$4::timestamptz)`,id,requiredString(row,"type"),requiredString(row,"description"),requiredString(row,"createdAt"));
  if (amount === 0) return;
  await financeDb.rawExec(`INSERT INTO ledger_entries (id,transaction_id,account_id,direction,amount,currency) VALUES ($1,$2,$3,$4,$5::numeric,'ZAR'),($6,$2,$7,$8,$5::numeric,'ZAR')`,requiredString(row,"memberEntryId"),id,memberAccount,amount>=0?"credit":"debit",Math.abs(amount).toFixed(2),requiredString(row,"systemEntryId"),systemAccount,amount>=0?"debit":"credit");
}

async function importLegacyShare(row: Record<string, unknown>) {
  await sharesDb.rawExec(`INSERT INTO share_purchases (id,profile_id,phase_id,quantity,bonus_quantity,total_amount,status,created_at) SELECT $1,$2,id,$4,0,$5::numeric,$6,$7::timestamptz FROM share_phases WHERE phase_number=$3 ON CONFLICT (id) DO NOTHING`,requiredString(row,"id"),requiredString(row,"profileId"),Number(row.phase),Number(row.quantity),String(row.totalAmount),requiredString(row,"status").toLowerCase(),requiredString(row,"createdAt"));
  await sharesDb.rawExec(`INSERT INTO share_certificates (id,profile_id,certificate_number,total_shares,status,issued_at,revoked_at) VALUES ($1,$2,$3,$4,$5,$6::timestamptz,$7::timestamptz) ON CONFLICT (certificate_number) DO NOTHING`,requiredString(row,"certificateId"),requiredString(row,"profileId"),requiredString(row,"certificateNo"),Number(row.quantity),requiredString(row,"status").toLowerCase(),requiredString(row,"createdAt"),row.status==='REVOKED'?requiredString(row,"createdAt"):null);
}

async function importLegacyAureusShare(row: Record<string, unknown>) { await sharesDb.rawExec(`INSERT INTO aureus_share_holdings (id,profile_id,phase_number,price_per_share,quantity,total_amount,certificate_number,previous_certificate_number,status,created_at) VALUES ($1,$2,$3,$4::numeric,$5,$6::numeric,$7,$8,$9,$10::timestamptz) ON CONFLICT (id) DO NOTHING`,requiredString(row,"id"),requiredString(row,"profileId"),Number(row.phase),String(row.pricePerShare),Number(row.quantity),String(row.totalAmount),requiredString(row,"certificateNo"),nullableString(row.prevCertificateNo),requiredString(row,"status").toLowerCase(),requiredString(row,"createdAt")); }
async function importLegacyDividend(row: Record<string, unknown>) { await financeDb.rawExec(`INSERT INTO dividend_declarations (id,amount,total_shares,per_share_amount,status,declared_at,paid_at) VALUES ($1,$2::numeric,$3,$4::numeric,$5,$6::timestamptz,$7::timestamptz) ON CONFLICT (id) DO NOTHING`,requiredString(row,"id"),String(row.amount),Number(row.totalShares),String(row.perShareAmount),requiredString(row,"status").toLowerCase(),requiredString(row,"declaredAt"),nullableString(row.paidAt)); }
async function importLegacyPoolDistribution(row: Record<string, unknown>) { await financeDb.rawExec(`INSERT INTO pool_distributions (id,batch_id,profile_id,amount,source,pool_type,status,payout_date) VALUES ($1,$2,$3,$4::numeric,$5,$6,$7,$8::timestamptz) ON CONFLICT (id) DO NOTHING`,requiredString(row,"id"),requiredString(row,"batchId"),requiredString(row,"profileId"),String(row.amount),requiredString(row,"source"),requiredString(row,"poolType"),requiredString(row,"status").toLowerCase(),requiredString(row,"payoutDate")); }
async function importLegacyMarketplaceProduct(row: Record<string, unknown>) { await commerceDb.rawExec(`INSERT INTO marketplace_products (id,name,description,category,provider,price,free_price,currency,commission_pct,image_color,rating,popular,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6::numeric,$7::numeric,$8,$9::numeric,$10,$11::numeric,$12,$13::timestamptz,$13::timestamptz) ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,price=EXCLUDED.price,free_price=EXCLUDED.free_price`,requiredString(row,"id"),requiredString(row,"name"),requiredString(row,"description"),requiredString(row,"category"),requiredString(row,"provider"),String(row.price),String(row.freePrice),requiredString(row,"currency"),String(row.commissionPct),requiredString(row,"imageColor"),String(row.rating),Boolean(row.popular),requiredString(row,"createdAt")); }
async function importLegacyMarketplaceOrder(row: Record<string, unknown>) { await commerceDb.rawExec(`INSERT INTO marketplace_orders (id,profile_id,product_id,product_name,amount,pricing_tier,commission,status,created_at) VALUES ($1,$2,$3,$4,$5::numeric,$6,$7::numeric,$8,$9::timestamptz) ON CONFLICT (id) DO NOTHING`,requiredString(row,"id"),requiredString(row,"profileId"),requiredString(row,"productId"),requiredString(row,"productName"),String(row.amount),requiredString(row,"pricingTier"),String(row.commission),requiredString(row,"status"),requiredString(row,"createdAt")); }
async function importLegacyMallTransaction(row: Record<string, unknown>) { await commerceDb.rawExec(`INSERT INTO mall_transactions (id,profile_id,nfc_tag_id,store_name,amount,cost_of_sale,vat,share_pool,kasi_pool,status,created_at) VALUES ($1,$2,$3,$4,$5::numeric,$6::numeric,$7::numeric,$8::numeric,$9::numeric,$10,$11::timestamptz) ON CONFLICT (id) DO NOTHING`,requiredString(row,"id"),nullableString(row.profileId),requiredString(row,"nfcTagId"),requiredString(row,"storeName"),String(row.amount),String(row.costOfSale),String(row.vat),String(row.sharePool),String(row.kasiPool),requiredString(row,"status"),requiredString(row,"createdAt")); }
async function importLegacyRootsBankShare(row: Record<string, unknown>) { await commerceDb.rawExec(`INSERT INTO roots_bank_shares (id,profile_id,category,share_price,membership_fee,total_amount,payment_ref,pioneer_pool,status,created_at) VALUES ($1,$2,$3,$4::numeric,$5::numeric,$6::numeric,$7,$8,$9,$10::timestamptz) ON CONFLICT (profile_id) DO UPDATE SET category=EXCLUDED.category,share_price=EXCLUDED.share_price,membership_fee=EXCLUDED.membership_fee,total_amount=EXCLUDED.total_amount,payment_ref=EXCLUDED.payment_ref,pioneer_pool=EXCLUDED.pioneer_pool,status=EXCLUDED.status,created_at=EXCLUDED.created_at`,requiredString(row,"id"),requiredString(row,"profileId"),requiredString(row,"category"),String(row.sharePrice),String(row.membershipFee),String(row.totalAmount),requiredString(row,"paymentRef"),Boolean(row.pioneerPool),requiredString(row,"status"),requiredString(row,"createdAt")); }
async function importLegacyRootsBankDuplicate(row: Record<string, unknown>) { await auditDb.rawExec(`INSERT INTO audit_logs (id,action,entity_type,entity_id,after,created_at) VALUES ($1,'migration.duplicate_roots_bank_registration','profile',$2,$3::jsonb,$4::timestamptz) ON CONFLICT (id) DO NOTHING`,requiredString(row,"auditId"),requiredString(row,"profileId"),JSON.stringify(row),requiredString(row,"createdAt")); }
async function importLegacyReferral(row: Record<string, unknown>) { await engagementDb.rawExec(`INSERT INTO referrals (id,referrer_profile_id,referred_profile_id,referral_code,referred_name,referred_email,referred_mobile,status,reward_amount,created_at,converted_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::numeric,$10::timestamptz,$11::timestamptz) ON CONFLICT (id) DO NOTHING`,requiredString(row,"id"),requiredString(row,"referrerProfileId"),nullableString(row.referredProfileId),requiredString(row,"referralCode"),requiredString(row,"referredName"),requiredString(row,"referredEmail"),requiredString(row,"referredMobile"),requiredString(row,"status"),String(row.rewardAmount),requiredString(row,"createdAt"),nullableString(row.convertedAt)); }
async function importLegacyVoucher(row: Record<string, unknown>) { await engagementDb.rawExec(`INSERT INTO vouchers (id,profile_id,code,title,description,provider,value,category,status,issue_date,expiry_date,anniversary_date,wablast_sent,expiring_sent,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7::numeric,$8,$9,$10::timestamptz,$11::timestamptz,$12::timestamptz,$13,$14,$15::timestamptz) ON CONFLICT (id) DO NOTHING`,requiredString(row,"id"),requiredString(row,"profileId"),requiredString(row,"code"),requiredString(row,"title"),requiredString(row,"description"),requiredString(row,"provider"),String(row.value),requiredString(row,"category"),requiredString(row,"status"),requiredString(row,"issueDate"),requiredString(row,"expiryDate"),nullableString(row.anniversaryDate),Boolean(row.wablastSent),Boolean(row.expiringSent),requiredString(row,"createdAt")); }
async function importLegacySubscriptionNotification(row: Record<string, unknown>) { await engagementDb.rawExec(`INSERT INTO subscription_notifications (id,profile_id,days_before,billing_period,channel,status,message,sent_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::timestamptz) ON CONFLICT (profile_id,days_before,billing_period) DO UPDATE SET channel=EXCLUDED.channel,status=EXCLUDED.status,message=EXCLUDED.message,sent_at=EXCLUDED.sent_at`,requiredString(row,"id"),requiredString(row,"profileId"),Number(row.daysBefore),requiredString(row,"billingPeriod"),requiredString(row,"channel"),requiredString(row,"status"),requiredString(row,"message"),requiredString(row,"sentAt")); }
async function importLegacySetting(row: Record<string, unknown>) { await membershipDb.rawExec(`INSERT INTO business_config_versions (id,config_key,version,effective_from,config) VALUES ($1,$2,1,$3::timestamptz,$4::jsonb) ON CONFLICT (config_key,version) DO UPDATE SET config=EXCLUDED.config,effective_from=EXCLUDED.effective_from`,requiredString(row,"id"),requiredString(row,"key"),requiredString(row,"updatedAt"),JSON.stringify({value:row.value,category:row.category})); }
async function importLegacySilo(row: Record<string, unknown>) { await commerceDb.rawExec(`INSERT INTO silo_config (id,name,percentage,description,color,sort_order,updated_at) VALUES ($1,$2,$3::numeric,$4,$5,$6,$7::timestamptz) ON CONFLICT (name) DO UPDATE SET percentage=EXCLUDED.percentage,description=EXCLUDED.description,color=EXCLUDED.color,sort_order=EXCLUDED.sort_order,updated_at=EXCLUDED.updated_at`,requiredString(row,"id"),requiredString(row,"name"),String(row.percentage),nullableString(row.description),requiredString(row,"color"),Number(row.sortOrder),requiredString(row,"updatedAt")); }
async function importLegacyAuditNotification(row: Record<string, unknown>) { await auditDb.rawExec(`INSERT INTO audit_logs (id,action,entity_type,entity_id,after,created_at) VALUES ($1,'legacy.auditor_notification','profile',$2,$3::jsonb,$4::timestamptz) ON CONFLICT (id) DO NOTHING`,requiredString(row,"id"),requiredString(row,"profileId"),JSON.stringify({monthEarnings:row.monthEarnings,month:row.month,status:row.status}),requiredString(row,"sentAt")); }
async function importLegacyWalletBalance(row: Record<string, unknown>) { await networkDb.rawExec(`INSERT INTO wallets (id,profile_id,currency,status,cached_balance) VALUES ($1,$2,'ZAR','active',$3::numeric) ON CONFLICT (profile_id) DO UPDATE SET cached_balance=EXCLUDED.cached_balance,currency=EXCLUDED.currency,status=EXCLUDED.status`,requiredString(row,"id"),requiredString(row,"profileId"),String(row.balance)); }

function requiredString(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  if (typeof value !== "string" || value.length === 0) throw new Error(`invalid_legacy_field:${key}`);
  return value;
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export const debugMemberState = api<
  { profileId: string },
  {
    wallet: { profile_id: string; currency: string; cached_balance: string } | null;
    matrixNode: {
      id: string;
      profile_id: string;
      parent_node_id: string | null;
      sponsor_profile_id: string | null;
      position_index: number;
      depth: number;
      path: string;
    } | null;
  }
>(
  { method: "GET", path: "/admin/debug/member/:profileId", expose: true },
  async (req) => {
    await requireAdminAccess();
    const wallet = await networkDb.rawQueryRow<{
      profile_id: string;
      currency: string;
      cached_balance: string;
    }>("SELECT profile_id, currency, cached_balance::text AS cached_balance FROM wallets WHERE profile_id = $1 ORDER BY created_at DESC LIMIT 1", req.profileId);
    const matrixNode = await networkDb.rawQueryRow<{
      id: string;
      profile_id: string;
      parent_node_id: string | null;
      sponsor_profile_id: string | null;
      position_index: number;
      depth: number;
      path: string;
    }>("SELECT id, profile_id, parent_node_id, sponsor_profile_id, position_index, depth, path FROM matrix_nodes WHERE profile_id = $1", req.profileId);
    return { wallet, matrixNode };
  },
);

export const matrixTree = api<
  void,
  { nodes: MatrixTreeNode[] }
>(
  { method: "GET", path: "/admin/matrix/tree", expose: true },
  async () => {
    await requireAdminAccess();
    const rows = await networkDb.rawQueryAll<{
      profile_id: string;
      parent_node_id: string | null;
      sponsor_profile_id: string | null;
      position_index: number;
      depth: number;
      path: string;
    }>("SELECT profile_id, parent_node_id, sponsor_profile_id, position_index, depth, path FROM matrix_nodes ORDER BY depth, position_index",
    );
    return {
      nodes: rows.map((row) => ({
        profileId: row.profile_id,
        parentNodeId: row.parent_node_id,
        sponsorProfileId: row.sponsor_profile_id,
        positionIndex: row.position_index,
        depth: row.depth,
        path: row.path,
      })),
    };
  },
);

async function legacyPlaceMatrixNode(profileId: string, sponsorProfileId: string | null) {
  // Serialized breadth-first placement preserves the five-child, six-level contract. Klaasvaakie ( |╲ )
  const tx = await networkDb.begin();
  try {
    await tx.rawExec("SELECT pg_advisory_xact_lock(hashtext('kasihub-matrix-placement'))");
    const existing = await tx.rawQueryRow<{
      id: string;
      profile_id: string;
      parent_node_id: string | null;
      sponsor_profile_id: string | null;
      position_index: number;
      depth: number;
      path: string;
    }>("SELECT id, profile_id, parent_node_id, sponsor_profile_id, position_index, depth, path FROM matrix_nodes WHERE profile_id = $1", profileId);
    if (existing) {
      await tx.commit();
      return { id: existing.id, profileId: existing.profile_id, parentNodeId: existing.parent_node_id,
        sponsorProfileId: existing.sponsor_profile_id, positionIndex: existing.position_index, depth: existing.depth, path: existing.path };
    }

    const count = await tx.rawQueryRow<{ count: string }>("SELECT COUNT(*)::text AS count FROM matrix_nodes");
    const parent = Number(count?.count ?? 0) === 0 ? null : await tx.rawQueryRow<{
      id: string; depth: number; path: string; child_count: number;
    }>(`SELECT n.id, n.depth, n.path, COUNT(c.id)::int AS child_count
        FROM matrix_nodes n LEFT JOIN matrix_nodes c ON c.parent_node_id = n.id
        WHERE n.depth < 5
        GROUP BY n.id, n.depth, n.path, n.profile_id, n.created_at
        HAVING COUNT(c.id) < 5
        ORDER BY CASE WHEN n.profile_id = $1 THEN 0 ELSE 1 END, n.depth, n.path, n.created_at
        LIMIT 1`, sponsorProfileId);
    if (Number(count?.count ?? 0) > 0 && !parent) throw APIError.resourceExhausted("The current 5x6 ecosystem is full");

    const nodeId = crypto.randomUUID();
    const depth = parent ? parent.depth + 1 : 0;
    const positionIndex = parent?.child_count ?? 0;
    const path = parent ? `${parent.path}.${positionIndex}` : "0";
    await tx.rawExec(`INSERT INTO matrix_nodes (
      id, profile_id, parent_node_id, sponsor_profile_id, position_index, depth, path
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      nodeId, profileId, parent?.id ?? null, sponsorProfileId, positionIndex, depth, path);
    await tx.commit();
    return { id: nodeId, profileId, parentNodeId: parent?.id ?? null, sponsorProfileId, positionIndex, depth, path };
  } catch (error) { await tx.rollback(); throw error; }
}

export const listLedgerTransactions = api<
  void,
  {
    transactions: {
      id: string;
      transactionType: string;
      referenceType: string;
      referenceId: string;
      description: string;
      createdAt: string;
      profileId: string | null;
      amount: number;
    }[];
  }
>(
  { method: "GET", path: "/admin/ledger/transactions", expose: true },
  async () => {
    await requireAdminAccess();
    const rows = await financeDb.rawQueryAll<{
      id: string;
      transaction_type: string;
      reference_type: string;
      reference_id: string;
      description: string;
      created_at: string;
      profile_id: string | null;
      amount: string;
    }>(`SELECT lt.id, lt.transaction_type, lt.reference_type, lt.reference_id, lt.description, lt.created_at,
              MAX(CASE WHEN la.owner_type = 'profile' THEN la.owner_id::text END) AS profile_id,
              COALESCE(SUM(CASE
                WHEN la.owner_type = 'profile' AND le.direction = 'credit' THEN le.amount
                WHEN la.owner_type = 'profile' AND le.direction = 'debit' THEN -le.amount
                ELSE 0 END), 0)::text AS amount
       FROM ledger_transactions lt
       LEFT JOIN ledger_entries le ON le.transaction_id = lt.id
       LEFT JOIN ledger_accounts la ON la.id = le.account_id
       GROUP BY lt.id
       ORDER BY lt.created_at DESC
       LIMIT 200`,
    );
    return {
      transactions: rows.map((row) => ({
        id: row.id,
        transactionType: row.transaction_type,
        referenceType: row.reference_type,
        referenceId: row.reference_id,
        description: row.description,
        createdAt: row.created_at,
        profileId: row.profile_id,
        amount: Number(row.amount),
      })),
    };
  },
);
