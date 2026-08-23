// Author: Klaasvaakie ( |╲ )
import { api, APIError } from "encore.dev/api";
import { z } from "zod";
import { auditDb, financeDb, identityDb, membershipDb, networkDb } from "../../resources";
import { requireAdminAccess, requireEcosystemProfileAccess } from "../auth/access";
import { ensureLedgerAccount as ensureDomainLedgerAccount } from "../wallets/ledger";
import {
  beginOperation,
  captureWalletHold,
  completeOperation,
  failOperation,
  placeWalletHold,
  recordStep,
  requireIdempotencyKey,
} from "../workflows/core";
import { placeMatrixNode } from "../network/placement";
import { ensureMembershipPlan } from "./plans";

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

const subscribeRequest = z.object({
  profileId: z.string().min(1),
  planCode: z.string().min(1),
});

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

export const subscribeMembership = api<SubscribeRequest, SubscribeResponse>(
  { method: "POST", path: "/membership/subscribe", expose: true },
  async (req) => {
    const payload = subscribeRequest.parse(req);
    const session = await requireEcosystemProfileAccess(payload.profileId);
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
    await requireEcosystemProfileAccess(req.profileId);
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
