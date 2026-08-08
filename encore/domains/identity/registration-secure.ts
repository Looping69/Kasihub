// Author: Klaasvaakie ( |╲ )
import { api, APIError } from "encore.dev/api";
import { z } from "zod";
import { identityDb, kycDb, membershipDb } from "../../resources";
import { hashPassword } from "../auth/password";
import { ensureMembershipPlan } from "../membership/plans";
import { INTERNATIONAL_KYC_PROVIDER } from "../kyc/policy";
import { resolveRegistrationPolicy } from "../shared/member-routing";
import { requestHash } from "../workflows/core";

interface SecureRegistrationRequest {
  email: string;
  password: string;
  phone?: string;
  firstName?: string;
  surname?: string;
  companyName?: string;
  companyRegistrationNumber?: string;
  idOrPassportNumber?: string;
  sarsNumber?: string;
  country?: string;
  membershipType: string;
  citizenshipType: string;
  addressLine?: string;
  city?: string;
  postalCode?: string;
  beneficiaryName?: string;
  beneficiaryId?: string;
  guardianName?: string;
  uplineProfileNumber?: string;
  uplineConfirmed?: boolean;
}

interface SecureRegistrationResponse {
  registrationId: string;
  status: "kyc_pending" | "awaiting_payment";
  nextAction: "kyc" | "payment";
  routing: {
    kycRail: "instapay" | "kasihub_international";
    paymentRail: "instapay" | "usdt";
  };
  user: { id: string; email: string; profileId: string; profileNumber: string };
}

const secureRegistrationRequest = z.object({
  email: z.string().email(),
  password: z.string().min(12).max(128),
  phone: z.string().max(50).optional(),
  firstName: z.string().max(200).optional(),
  surname: z.string().max(200).optional(),
  companyName: z.string().max(300).optional(),
  companyRegistrationNumber: z.string().max(100).optional(),
  idOrPassportNumber: z.string().max(100).optional(),
  sarsNumber: z.string().max(100).optional(),
  country: z.string().max(100).optional(),
  membershipType: z.string().min(1).max(100),
  citizenshipType: z.string().min(1).max(100),
  addressLine: z.string().max(500).optional(),
  city: z.string().max(200).optional(),
  postalCode: z.string().max(30).optional(),
  beneficiaryName: z.string().max(300).optional(),
  beneficiaryId: z.string().max(100).optional(),
  guardianName: z.string().max(300).optional(),
  uplineProfileNumber: z.string().max(100).optional(),
  uplineConfirmed: z.boolean().optional(),
});

function resolvePolicyOrThrow(citizenshipType: string, membershipType: string) {
  try {
    return resolveRegistrationPolicy(citizenshipType, membershipType);
  } catch (error) {
    if (error instanceof Error && error.message === "unsupported_citizenship_type") {
      throw APIError.invalidArgument("Unsupported citizenship type");
    }
    if (error instanceof Error && error.message === "unsupported_membership_type") {
      throw APIError.invalidArgument("Unsupported membership type");
    }
    throw error;
  }
}

/**
 * Server-authoritative registration coordinator.
 *
 * Trust boundary:
 * - caller supplies applicant facts only;
 * - Encore derives profile type, membership plan, KYC rail and payment rail;
 * - provider verification timestamps/references are never accepted here;
 * - every supported applicant enters the correct KYC rail automatically.
 */
export const startSecureRegistration = api<SecureRegistrationRequest, SecureRegistrationResponse>(
  { method: "POST", path: "/registration/secure-start", expose: true },
  async (req) => {
    const payload = secureRegistrationRequest.parse(req);
    const normalizedEmail = payload.email.trim().toLowerCase();
    const policy = resolvePolicyOrThrow(payload.citizenshipType, payload.membershipType);
    const authoritativeRequest = {
      ...payload,
      email: normalizedEmail,
      profileType: policy.profileType,
      membershipPlanCode: policy.membershipPlanCode,
      kycRail: policy.kycRail,
      paymentRail: policy.paymentRail,
    };
    const payloadHash = requestHash(authoritativeRequest);

    let workflow = await identityDb.rawQueryRow<{
      id: string; request_hash: string; user_id: string | null; profile_id: string | null; state: string;
    }>("SELECT id, request_hash, user_id, profile_id, state FROM registration_workflows WHERE email = $1", normalizedEmail);
    if (workflow && workflow.request_hash !== payloadHash) {
      throw APIError.alreadyExists("A registration already exists for this email with different details");
    }
    if (!workflow) {
      const workflowId = crypto.randomUUID();
      try {
        await identityDb.rawExec(
          `INSERT INTO registration_workflows
            (id, email, request_hash, membership_plan_code, create_kyc)
           VALUES ($1, $2, $3, $4, true)`,
          workflowId,
          normalizedEmail,
          payloadHash,
          policy.membershipPlanCode,
        );
      } catch {
        // Concurrent identical registration may have won the unique email constraint.
      }
      workflow = await identityDb.rawQueryRow<{
        id: string; request_hash: string; user_id: string | null; profile_id: string | null; state: string;
      }>("SELECT id, request_hash, user_id, profile_id, state FROM registration_workflows WHERE email = $1", normalizedEmail);
      if (!workflow || workflow.request_hash !== payloadHash) {
        throw APIError.alreadyExists("A registration already exists for this email");
      }
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
          await tx.rawExec(
            "INSERT INTO users (id, email, phone, password_hash) VALUES ($1, $2, $3, $4)",
            userId,
            normalizedEmail,
            payload.phone ?? null,
            hashPassword(payload.password),
          );
          await tx.rawExec(
            `INSERT INTO profiles (
              id, user_id, profile_type, unique_profile_number, first_name, surname,
              company_name, company_registration_number, id_or_passport_number, sars_number, country, status,
              membership_type, citizenship_type, address_line, city, postal_code, beneficiary_name, beneficiary_id,
              guardian_name, instapay_status, instapay_verified_at, instapay_account_ref, upline_profile_number, upline_confirmed
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'pending',$12,$13,$14,$15,$16,$17,$18,$19,$20,NULL,NULL,$21,$22)`,
            profileId,
            userId,
            policy.profileType,
            profileNumber,
            payload.firstName ?? null,
            payload.surname ?? null,
            payload.companyName ?? null,
            payload.companyRegistrationNumber ?? null,
            payload.idOrPassportNumber ?? null,
            payload.sarsNumber ?? null,
            payload.country ?? (policy.isInternational ? null : "ZA"),
            policy.membershipType,
            policy.citizenshipType,
            payload.addressLine ?? null,
            payload.city ?? null,
            payload.postalCode ?? null,
            payload.beneficiaryName ?? null,
            payload.beneficiaryId ?? null,
            payload.guardianName ?? null,
            policy.kycRail === "instapay" ? "PENDING" : "NONE",
            payload.uplineProfileNumber ?? null,
            Boolean(payload.uplineConfirmed),
          );
          await tx.rawExec(
            `INSERT INTO user_roles (user_id, role_id)
             SELECT $1, id FROM roles WHERE name = 'member'
             ON CONFLICT (user_id, role_id) DO NOTHING`,
            userId,
          );
          await tx.rawExec(
            `UPDATE registration_workflows
                SET user_id = $2, profile_id = $3, state = 'identity_created', last_error = NULL, updated_at = now()
              WHERE id = $1`,
            workflow.id,
            userId,
            profileId,
          );
          await tx.commit();
          workflow.user_id = userId;
          workflow.profile_id = profileId;
          workflow.state = "identity_created";
        } catch (error) {
          await tx.rollback();
          throw error;
        }
      }

      const plan = await membershipDb.rawQueryRow<{ id: string; code: string; amount: string; currency: string }>(
        "SELECT id, code, amount::text AS amount, currency FROM membership_plans WHERE code = $1 AND active = true",
        policy.membershipPlanCode,
      );
      const materializedPlan = plan ?? await ensureMembershipPlan(policy.membershipPlanCode);
      const subscriptionId = crypto.randomUUID();
      const paymentId = crypto.randomUUID();
      await membershipDb.rawExec(
        `INSERT INTO subscriptions (id, profile_id, plan_id, status, registration_id, starts_at)
         VALUES ($1, $2, $3, 'pending', $4, now())
         ON CONFLICT (registration_id) WHERE registration_id IS NOT NULL DO NOTHING`,
        subscriptionId,
        workflow.profile_id,
        materializedPlan.id,
        workflow.id,
      );
      const subscription = await membershipDb.rawQueryRow<{ id: string }>(
        "SELECT id FROM subscriptions WHERE registration_id = $1",
        workflow.id,
      );
      if (!subscription) throw new Error("registration_subscription_not_created");

      await membershipDb.rawExec(
        `INSERT INTO payments
          (id, profile_id, subscription_id, provider, provider_reference, amount, currency, status, metadata)
         VALUES ($1, $2, $3, 'pending_rail', $4, $5::numeric, $6, 'pending', $7::jsonb)
         ON CONFLICT (provider_reference) DO NOTHING`,
        paymentId,
        workflow.profile_id,
        subscription.id,
        `registration-${workflow.id}`,
        materializedPlan.amount,
        materializedPlan.currency,
        JSON.stringify({
          registrationId: workflow.id,
          planCode: materializedPlan.code,
          kycRail: policy.kycRail,
          paymentRail: policy.paymentRail,
        }),
      );
      await identityDb.rawExec(
        "UPDATE registration_workflows SET state = 'membership_pending', last_error = NULL, updated_at = now() WHERE id = $1",
        workflow.id,
      );

      const kycProvider = policy.kycRail === "instapay" ? "instapay" : INTERNATIONAL_KYC_PROVIDER;
      await kycDb.rawExec(
        `INSERT INTO kyc_cases (profile_id, provider, status, registration_id, submitted_at)
         VALUES ($1, $2, 'pending', $3, now())
         ON CONFLICT (registration_id) WHERE registration_id IS NOT NULL DO NOTHING`,
        workflow.profile_id,
        kycProvider,
        workflow.id,
      );
      await identityDb.rawExec(
        "UPDATE registration_workflows SET state = 'kyc_pending', updated_at = now() WHERE id = $1",
        workflow.id,
      );

      // Registration is durable, but international users must complete Kasihub KYC
      // before paid/regulatory actions. Local KYC continues through InstaPay.
      await identityDb.rawExec(
        `UPDATE registration_workflows
            SET state = 'completed', last_error = NULL, completed_at = now(), updated_at = now()
          WHERE id = $1`,
        workflow.id,
      );
      const profile = await identityDb.rawQueryRow<{ unique_profile_number: string }>(
        "SELECT unique_profile_number FROM profiles WHERE id = $1",
        workflow.profile_id,
      );
      if (!profile || !workflow.user_id || !workflow.profile_id) throw new Error("registration_identity_not_found");

      return {
        registrationId: workflow.id,
        status: policy.isInternational ? "kyc_pending" : "awaiting_payment",
        nextAction: policy.isInternational ? "kyc" : "payment",
        routing: { kycRail: policy.kycRail, paymentRail: policy.paymentRail },
        user: {
          id: workflow.user_id,
          email: normalizedEmail,
          profileId: workflow.profile_id,
          profileNumber: profile.unique_profile_number,
        },
      };
    } catch (error) {
      await identityDb.rawExec(
        `UPDATE registration_workflows
            SET state = 'failed', last_error = $2, retry_count = retry_count + 1, updated_at = now()
          WHERE id = $1`,
        workflow.id,
        (error instanceof Error ? error.message : String(error)).slice(0, 1000),
      );
      throw error;
    }
  },
);
