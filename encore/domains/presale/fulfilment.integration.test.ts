// Author: Klaasvaakie ( |╲ )
import { describe, expect, it } from "vitest";
import { identityDb, presaleDb, sharesDb } from "../../resources";
import { encryptInvestorApplication, fulfilSettledPresalePayment, rejectPresalePayment, reconcileConfirmedPresaleOrders, expirePresaleOrders } from "./api";

async function seedOrders(phase = 1) {
  const campaignId = crypto.randomUUID();
  const invitationId = crypto.randomUUID();
  const profileId = crypto.randomUUID();
  const userId = crypto.randomUUID();
  const fulfilledIntentId = crypto.randomUUID();
  const rejectedIntentId = crypto.randomUUID();
  const fulfilledReference = `KSP-FULFIL-${crypto.randomUUID()}`;
  const rejectedReference = `KSP-REJECT-${crypto.randomUUID()}`;
  const investorApplication = encryptInvestorApplication({
    streetAddress: "1 Legacy Street",
    suburb: "Test Suburb",
    city: "Johannesburg",
    postalCode: "2001",
    countryOfResidence: "South Africa",
  });
  await identityDb.rawExec(
    "INSERT INTO users (id,email,status) VALUES ($1,$2,'active')",
    userId,
    `legacy-${crypto.randomUUID()}@example.test`,
  );
  await identityDb.rawExec(
    `INSERT INTO profiles (id,user_id,profile_type,unique_profile_number,first_name,surname,status)
     VALUES ($1,$2,'individual',$3,'Legacy','Tester','active')`,
    profileId,
    userId,
    `KSI-${crypto.randomUUID()}`,
  );
  await presaleDb.rawExec(`INSERT INTO presale_campaigns
    (id,slug,name,issuer_name,status,total_shares,reserved_shares,sold_shares,price_usdt,price_usd,network,receiving_address,min_confirmations,bonus_buy_one_get_one,share_phase_number)
    VALUES ($1,$2,'Legacy-tier test','KaSiShares','active',100,4,0,25,25,'bsc','0x2222222222222222222222222222222222222222',3,true,$3)`,
  campaignId, `legacy-${crypto.randomUUID()}`, phase);
  await presaleDb.rawExec(`INSERT INTO presale_invitations
    (id,campaign_id,token_hash,max_shares,used_shares,status) VALUES ($1,$2,$3,2,2,'exhausted')`,
  invitationId, campaignId, crypto.randomUUID());
  for (const [reference, intentId] of [[fulfilledReference, fulfilledIntentId], [rejectedReference, rejectedIntentId]]) {
    await presaleDb.rawExec(`INSERT INTO presale_orders
      (id,order_reference,campaign_id,invitation_id,buyer_name,buyer_email,external_profile_id,quantity,
       unit_price_usdt,total_usdt,unit_price_usd,total_usd,usdt_per_usd,quote_reference,status,
       idempotency_key_hash,request_hash,access_token_hash,terms_version,terms_accepted_at,payment_deadline,
       payment_obligation_id,payment_intent_id,payment_network,payment_receiving_address,payment_token_contract,payment_min_confirmations,
       investor_application_ciphertext,investor_application_nonce,investor_application_auth_tag)
      VALUES ($1,$2,$3,$4,'Legacy Tester','legacy@example.test',$5,1,25,25,25,25,1,'test','payment_submitted',
       $6,$7,$8,'2026-08-01',now(),now()+interval '30 minutes',$9,$10,'bsc',
       '0x2222222222222222222222222222222222222222','0x1111111111111111111111111111111111111111',3,$11,$12,$13)`,
    crypto.randomUUID(), reference, campaignId, invitationId, profileId,
    crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID(), intentId,
    investorApplication.ciphertext, investorApplication.nonce, investorApplication.authTag);
  }
  return { campaignId, invitationId, fulfilledIntentId, rejectedIntentId, fulfilledReference, rejectedReference };
}

describe("presale settlement consumption", () => {
  it("expires unpaid allocations using their frozen bonus after a campaign edit, once",async()=>{
    const seeded=await seedOrders();
    await presaleDb.rawExec("UPDATE presale_orders SET status='awaiting_payment',payment_deadline=now()-interval '1 minute' WHERE campaign_id=$1",seeded.campaignId);
    await presaleDb.rawExec("UPDATE presale_campaigns SET bonus_buy_one_get_one=false WHERE id=$1",seeded.campaignId);
    await expirePresaleOrders();await expirePresaleOrders();
    expect(await presaleDb.rawQueryRow("SELECT reserved_shares,sold_shares FROM presale_campaigns WHERE id=$1",seeded.campaignId)).toEqual({reserved_shares:0,sold_shares:0});
    const rows=await presaleDb.rawQueryAll<{status:string}>("SELECT status FROM presale_orders WHERE campaign_id=$1",seeded.campaignId);
    expect(rows.every(row=>row.status==='expired')).toBe(true);
  });

  it("moves inventory once after settlement and releases a rejected reservation once", async () => {
    const seeded = await seedOrders();
    // Both fulfilment and release must use the original allocation, even if
    // an administrator edits the campaign after reservation.
    await presaleDb.rawExec("UPDATE presale_campaigns SET bonus_buy_one_get_one=false,share_phase_number=9999 WHERE id=$1", seeded.campaignId);
    const transactionHash = "a".repeat(64);
    await fulfilSettledPresalePayment(seeded.fulfilledReference, seeded.fulfilledIntentId, transactionHash, 3);
    await fulfilSettledPresalePayment(seeded.fulfilledReference, seeded.fulfilledIntentId, transactionHash, 3);
    await rejectPresalePayment(seeded.rejectedReference, seeded.rejectedIntentId);
    await rejectPresalePayment(seeded.rejectedReference, seeded.rejectedIntentId);
    const campaign = await presaleDb.rawQueryRow<{ reserved_shares: number; sold_shares: number }>(
      "SELECT reserved_shares,sold_shares FROM presale_campaigns WHERE id=$1", seeded.campaignId);
    const orders = await presaleDb.rawQueryAll<{ status: string }>(
      "SELECT status FROM presale_orders WHERE campaign_id=$1 ORDER BY status", seeded.campaignId);
    const invite = await presaleDb.rawQueryRow<{ used_shares: number; status: string }>(
      "SELECT used_shares,status FROM presale_invitations WHERE id=$1", seeded.invitationId);
    const certificate = await sharesDb.rawQueryRow<{ total_shares: number; source: string }>(
      "SELECT total_shares,source FROM share_certificates WHERE presale_order_reference=$1", seeded.fulfilledReference);
    const issuance = await sharesDb.rawQueryRow<{ operation_id: string; status: string }>(
      "SELECT operation_id,status FROM share_issuance_operations WHERE source_reference=$1", seeded.fulfilledReference);
    const delivery = await presaleDb.rawQueryRow<{ status: string; attempt_count: number }>(
      "SELECT status,attempt_count FROM presale_outbox WHERE aggregate_id=$1", seeded.fulfilledReference);
    const completion = await presaleDb.rawQueryRow<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM presale_inbox WHERE correlation_id=$1", `presale:${seeded.fulfilledReference}`);
    expect(campaign).toEqual({ reserved_shares: 0, sold_shares: 2 });
    expect(orders.map((row) => row.status)).toEqual(["cancelled", "incorporated"]);
    expect(invite).toEqual({ used_shares: 1, status: "active" });
    expect(certificate).toEqual({ total_shares: 2, source: "presale" });
    expect(issuance).toEqual({ operation_id: `presale:${seeded.fulfilledReference}`, status: "completed" });
    expect(delivery).toEqual({ status: "processed", attempt_count: 1 });
    expect(completion).toEqual({ count: "1" });
  });

  it("recovers failed issuance delivery after capacity becomes available without a second purchase", async () => {
    const phase = 80000 + Math.floor(Math.random() * 10000);
    const seeded = await seedOrders(phase);
    await fulfilSettledPresalePayment(seeded.fulfilledReference, seeded.fulfilledIntentId, "b".repeat(64), 3);
    const failedDelivery = await presaleDb.rawQueryRow<{ status: string; last_error_code: string | null }>(
      "SELECT status,last_error_code FROM presale_outbox WHERE aggregate_id=$1", seeded.fulfilledReference);
    expect(failedDelivery?.status).toBe("pending");
    expect(failedDelivery?.last_error_code).toBeTruthy();
    await sharesDb.rawExec("INSERT INTO share_phases (phase_number,quantity_available,total_quantity,price_per_share,currency,status) VALUES ($1,100,100,25,'USD','active')", phase);
    await presaleDb.rawExec("UPDATE presale_outbox SET available_at=now() WHERE aggregate_id=$1", seeded.fulfilledReference);
    await reconcileConfirmedPresaleOrders();
    await reconcileConfirmedPresaleOrders();
    const purchases = await sharesDb.rawQueryRow<{ count: number; shares: number }>(
      "SELECT count(*)::int AS count,SUM(quantity+bonus_quantity)::int AS shares FROM share_purchases WHERE presale_order_reference=$1", seeded.fulfilledReference);
    expect(purchases).toEqual({ count: 1, shares: 2 });
    const complete = await presaleDb.rawQueryRow<{ status: string }>("SELECT status FROM presale_outbox WHERE aggregate_id=$1", seeded.fulfilledReference);
    expect(complete?.status).toBe("processed");
  });

  it("rejects mutation of the reservation snapshot", async () => {
    const seeded = await seedOrders();
    await expect(presaleDb.rawExec("UPDATE presale_orders SET bonus_buy_one_get_one_snapshot=false WHERE order_reference=$1", seeded.fulfilledReference)).rejects.toThrow();
    const row = await presaleDb.rawQueryRow<{ bonus: boolean }>("SELECT bonus_buy_one_get_one_snapshot AS bonus FROM presale_orders WHERE order_reference=$1", seeded.fulfilledReference);
    expect(row?.bonus).toBe(true);
  });
});
