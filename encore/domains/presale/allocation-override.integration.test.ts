// Author: Klaasvaakie ( |╲ )
import { describe, expect, it } from "vitest";
import { identityDb, presaleDb, sharesDb } from "../../resources";
import { allowPresaleShareAllocationOverride, encryptInvestorApplication } from "./api";

async function seedSubmittedOverrideOrder() {
  const userId = crypto.randomUUID();
  const profileId = crypto.randomUUID();
  const campaignId = crypto.randomUUID();
  const invitationId = crypto.randomUUID();
  const orderId = crypto.randomUUID();
  const orderReference = `KSP-OVERRIDE-${crypto.randomUUID()}`;
  const phaseNumber = 700000 + Math.floor(Math.random() * 100000);
  const investorApplication = encryptInvestorApplication({
    streetAddress: "2 Evidence Road",
    suburb: "Audit Park",
    city: "Johannesburg",
    postalCode: "2001",
    countryOfResidence: "South Africa",
  });
  await identityDb.rawExec("INSERT INTO users (id,email,status) VALUES ($1,$2,'active')", userId, `override-${crypto.randomUUID()}@example.test`);
  await identityDb.rawExec(`INSERT INTO profiles
    (id,user_id,profile_type,unique_profile_number,first_name,surname,status,onboarding_authority)
    VALUES ($1,$2,'individual',$3,'Override','Investor','pending','instapay')`,
  profileId, userId, `KSI-${crypto.randomUUID()}`);
  await sharesDb.rawExec(`INSERT INTO share_phases
    (phase_number,quantity_available,total_quantity,price_per_share,currency,status,bonus_buy_one_get,starts_at)
    VALUES ($1,100,100,1,'USD','active',true,now())`, phaseNumber);
  await presaleDb.rawExec(`INSERT INTO presale_campaigns
    (id,slug,name,issuer_name,status,total_shares,reserved_shares,sold_shares,price_usdt,price_usd,
     share_phase_number,network,receiving_address,min_confirmations,bonus_buy_one_get_one)
    VALUES ($1,$2,'Override test','KaSiShares','active',100,2,0,1,1,$3,'bsc',
     '0x2222222222222222222222222222222222222222',3,true)`,
  campaignId, `override-${crypto.randomUUID()}`, phaseNumber);
  await presaleDb.rawExec(`INSERT INTO presale_invitations
    (id,campaign_id,token_hash,max_shares,used_shares,status) VALUES ($1,$2,$3,1,1,'exhausted')`,
  invitationId, campaignId, crypto.randomUUID());
  await presaleDb.rawExec(`INSERT INTO presale_orders
    (id,order_reference,campaign_id,invitation_id,buyer_name,buyer_email,external_profile_id,quantity,
     unit_price_usdt,total_usdt,unit_price_usd,total_usd,usdt_per_usd,quote_reference,status,
     idempotency_key_hash,request_hash,access_token_hash,terms_version,terms_accepted_at,payment_deadline,
     investor_application_ciphertext,investor_application_nonce,investor_application_auth_tag)
    VALUES ($1,$2,$3,$4,'Override Investor','override@example.test',$5,1,1,1,1,1,1,'override-test','payment_submitted',
     $6,$7,$8,'2026-08-01',now(),now()+interval '30 minutes',$9,$10,$11)`,
  orderId, orderReference, campaignId, invitationId, profileId,
  crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID(),
  investorApplication.ciphertext, investorApplication.nonce, investorApplication.authTag);
  return { userId, profileId, campaignId, orderId, orderReference };
}

describe("admin presale allocation override", () => {
  it("cannot create paid ownership without settled payment authority", async () => {
    const seeded = await seedSubmittedOverrideOrder();
    const request = {
      orderReference: seeded.orderReference,
      actorUserId: seeded.userId,
      reason: "Remitano custody authentication is unavailable; deposit evidence was independently reviewed.",
      evidenceReference: "provider-deposit-reference-12345",
    };
    await expect(allowPresaleShareAllocationOverride(request)).rejects.toThrow("Manual presale share allocation is disabled");
    const order = await presaleDb.rawQueryRow<{
      status: string; incorporation_status: string; payment_settled_at: string | null;
    }>("SELECT status,incorporation_status,payment_settled_at FROM presale_orders WHERE id=$1", seeded.orderId);
    const campaign = await presaleDb.rawQueryRow<{ reserved_shares: number; sold_shares: number }>(
      "SELECT reserved_shares,sold_shares FROM presale_campaigns WHERE id=$1", seeded.campaignId,
    );
    const overrides = await presaleDb.rawQueryRow<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM presale_allocation_overrides WHERE order_id=$1", seeded.orderId,
    );
    const certificates = await sharesDb.rawQueryRow<{ count: string; total: string }>(
      "SELECT COUNT(*)::text AS count,COALESCE(SUM(total_shares),0)::text AS total FROM share_certificates WHERE presale_order_reference=$1",
      seeded.orderReference,
    );
    expect(order).toEqual({ status: "payment_submitted", incorporation_status: "pending", payment_settled_at: null });
    expect(campaign).toEqual({ reserved_shares: 2, sold_shares: 0 });
    expect(overrides).toEqual({ count: "0" });
    expect(certificates).toEqual({ count: "0", total: "0" });
  }, 15_000);
});
