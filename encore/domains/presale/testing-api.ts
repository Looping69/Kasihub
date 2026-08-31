// Author: Klaasvaakie ( |╲ )
import { appMeta } from "encore.dev";
import { api, APIError } from "encore.dev/api";
import { identityDb, kycDb, presaleDb, sharesDb } from "../../resources";
import { hashSessionToken } from "../auth/access";
import { fulfilWebPayPresalePayment, incorporateConfirmedPresaleOrder } from "./api";
import { hashSecret } from "./model";

type E2ESetupResponse = {
  schemaVersion: "presale-e2e-run.v1";
  runId: string;
  inviteToken: string;
  sessionToken: string;
  email: string;
  profileId: string;
  profileNumber: string;
  campaignId: string;
  presalePath: string;
};

type E2ESettlementResponse = {
  schemaVersion: "presale-e2e-result.v1";
  runId: string;
  orderReference: string;
  orderStatus: string;
  incorporationStatus: string;
  purchaseId: string;
  certificate: {
    certificateNumber: string;
    verificationId: string;
    totalShares: number;
    paidShares: number;
    bonusShares: number;
    integrityHash: string;
  };
  delivery: {
    requestStatus: string;
    requestAttempts: number;
    completionRecorded: boolean;
  };
};

function requireTestEnvironment(): void {
  if (appMeta().environment.type === "production") {
    // Hide the test surface completely in production rather than advertising
    // a disabled administrative capability.
    throw APIError.notFound("Not found");
  }
}

export const createPresaleE2ERun = api<void, E2ESetupResponse>(
  { method: "POST", path: "/testing/presale/e2e-runs", expose: true, auth: false },
  async () => {
    requireTestEnvironment();
    const runId = crypto.randomUUID();
    const userId = crypto.randomUUID();
    const profileId = crypto.randomUUID();
    const campaignId = crypto.randomUUID();
    const invitationId = crypto.randomUUID();
    const email = `presale-e2e+${runId}@kasihub.test`;
    const profileNumber = `KSI-E2E-${runId.slice(0, 8).toUpperCase()}`;
    const inviteToken = `${crypto.randomUUID()}${crypto.randomUUID()}`;
    const sessionToken = `${crypto.randomUUID()}${crypto.randomUUID()}`;

    await identityDb.rawExec("INSERT INTO users (id,email,status) VALUES ($1,$2,'active')", userId, email);
    await identityDb.rawExec(`INSERT INTO profiles
      (id,user_id,profile_type,unique_profile_number,first_name,surname,country,address_line,city,postal_code,status,
       membership_type,citizenship_type,onboarding_authority)
      VALUES ($1,$2,'individual',$3,'End-to-end','Investor','ZA','1 Test Evidence Street','Johannesburg','2001','active',
       'PRESALE_INDIVIDUAL','PRESALE_INVESTOR','kasihub')`, profileId, userId, profileNumber);
    await identityDb.rawExec(`INSERT INTO user_roles (user_id,role_id)
      SELECT $1,id FROM roles WHERE name='presale_investor'`, userId);
    await identityDb.rawExec(`INSERT INTO sessions (user_id,token,session_scope,created_at,expires_at)
      VALUES ($1,$2,'presale',now(),now()+interval '2 hours')`, userId, hashSessionToken(sessionToken));
    await kycDb.rawExec(`INSERT INTO kyc_cases
      (id,profile_id,provider,status,submitted_at,reviewed_at,result_payload)
      VALUES ($1,$2,'kasihub_international','approved',now(),now(),$3::jsonb)`, crypto.randomUUID(), profileId,
    JSON.stringify({ testRunId: runId, synthetic: true, authority: "presale-e2e-harness" }));

    await sharesDb.rawExec(`INSERT INTO share_phases
      (phase_number,quantity_available,total_quantity,price_per_share,currency,status,bonus_buy_one_get,starts_at)
      VALUES (1,100000,100000,25.00,'USD','active',true,now())
      ON CONFLICT (phase_number) DO NOTHING`);
    await presaleDb.rawExec(`INSERT INTO presale_campaigns
      (id,slug,name,issuer_name,share_class,status,total_shares,reserved_shares,sold_shares,
       price_usdt,price_usd,usdt_per_usd,share_phase_number,network,token_contract,receiving_address,
       min_confirmations,payment_window_minutes,bonus_buy_one_get_one,is_mock)
      VALUES ($1,$2,'E2E Private Allocation','Solidus Holdings (Pty) Ltd','Class B','active',100,0,0,
       25,25,1,1,'bsc','0x1111111111111111111111111111111111111111','0x2222222222222222222222222222222222222222',
       3,120,true,true)`, campaignId, `e2e-${runId}`);
    await presaleDb.rawExec(`INSERT INTO presale_invitations
      (id,campaign_id,token_hash,email,max_shares,used_shares,status,expires_at)
      VALUES ($1,$2,$3,$4,10,0,'active',now()+interval '2 hours')`, invitationId, campaignId, hashSecret(inviteToken), email);

    return {
      schemaVersion: "presale-e2e-run.v1",
      runId,
      inviteToken,
      sessionToken,
      email,
      profileId,
      profileNumber,
      campaignId,
      presalePath: `/presale?invite=${encodeURIComponent(inviteToken)}`,
    };
  },
);

export const settlePresaleE2ERun = api<
  { runId: string; orderReference: string },
  E2ESettlementResponse
>(
  { method: "POST", path: "/testing/presale/e2e-runs/:runId/settle", expose: true, auth: false },
  async (req) => {
    requireTestEnvironment();
    const order = await presaleDb.rawQueryRow<{ id: string; order_reference: string; status: string }>(`SELECT o.id,o.order_reference,o.status
      FROM presale_orders o
      JOIN presale_campaigns campaign ON campaign.id=o.campaign_id
      WHERE o.order_reference=$1 AND campaign.slug=$2 AND campaign.is_mock=TRUE`, req.orderReference, `e2e-${req.runId}`);
    if (!order) throw APIError.notFound("E2E presale order not found");
    await fulfilWebPayPresalePayment(order.order_reference, `E2E-${req.runId}`, "e2e_simulated_card_settlement");
    await incorporateConfirmedPresaleOrder(order.order_reference);

    const result = await presaleDb.rawQueryRow<{
      status: string; incorporation_status: string; target_purchase_id: string;
      outbox_status: string; attempt_count: number; completion_recorded: boolean;
    }>(`SELECT o.status,o.incorporation_status,o.target_purchase_id,
              outbox.status AS outbox_status,outbox.attempt_count,
              EXISTS(SELECT 1 FROM presale_inbox inbox WHERE inbox.correlation_id=$2) AS completion_recorded
      FROM presale_orders o
      JOIN presale_outbox outbox ON outbox.aggregate_id=o.order_reference AND outbox.event_type='share_issuance_requested'
      WHERE o.id=$1`, order.id, `presale:${order.order_reference}`);
    const certificate = await sharesDb.rawQueryRow<{
      certificate_number: string; verification_id: string; total_shares: number; paid_shares: number;
      bonus_shares: number; certificate_payload_sha256: string;
    }>(`SELECT certificate_number,verification_id,total_shares,paid_shares,bonus_shares,certificate_payload_sha256
      FROM share_certificates WHERE presale_order_reference=$1`, order.order_reference);
    if (!result || !certificate || result.status !== "incorporated" || result.incorporation_status !== "incorporated") {
      throw APIError.failedPrecondition("E2E share issuance did not reach its authoritative terminal state");
    }
    return {
      schemaVersion: "presale-e2e-result.v1",
      runId: req.runId,
      orderReference: order.order_reference,
      orderStatus: result.status,
      incorporationStatus: result.incorporation_status,
      purchaseId: result.target_purchase_id,
      certificate: {
        certificateNumber: certificate.certificate_number,
        verificationId: certificate.verification_id,
        totalShares: certificate.total_shares,
        paidShares: certificate.paid_shares,
        bonusShares: certificate.bonus_shares,
        integrityHash: certificate.certificate_payload_sha256,
      },
      delivery: {
        requestStatus: result.outbox_status,
        requestAttempts: result.attempt_count,
        completionRecorded: result.completion_recorded,
      },
    };
  },
);
