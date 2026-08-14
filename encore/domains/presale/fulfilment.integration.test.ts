// Author: Klaasvaakie ( |╲ )
import { describe, expect, it } from "vitest";
import { presaleDb } from "../../resources";
import { fulfilSettledPresalePayment, rejectPresalePayment } from "./api";

async function seedOrders() {
  const campaignId = crypto.randomUUID();
  const invitationId = crypto.randomUUID();
  const profileId = crypto.randomUUID();
  const fulfilledIntentId = crypto.randomUUID();
  const rejectedIntentId = crypto.randomUUID();
  const fulfilledReference = `KSP-FULFIL-${crypto.randomUUID()}`;
  const rejectedReference = `KSP-REJECT-${crypto.randomUUID()}`;
  await presaleDb.rawExec(`INSERT INTO presale_campaigns
    (id,slug,name,issuer_name,status,total_shares,reserved_shares,sold_shares,price_usdt,price_usd,network,receiving_address,min_confirmations,bonus_buy_one_get_one)
    VALUES ($1,$2,'Legacy-tier test','KaSiShares','active',100,4,0,25,25,'bsc','0x2222222222222222222222222222222222222222',3,true)`,
  campaignId, `legacy-${crypto.randomUUID()}`);
  await presaleDb.rawExec(`INSERT INTO presale_invitations
    (id,campaign_id,token_hash,max_shares,used_shares,status) VALUES ($1,$2,$3,2,2,'exhausted')`,
  invitationId, campaignId, crypto.randomUUID());
  for (const [reference, intentId] of [[fulfilledReference, fulfilledIntentId], [rejectedReference, rejectedIntentId]]) {
    await presaleDb.rawExec(`INSERT INTO presale_orders
      (id,order_reference,campaign_id,invitation_id,buyer_name,buyer_email,external_profile_id,quantity,
       unit_price_usdt,total_usdt,unit_price_usd,total_usd,usdt_per_usd,quote_reference,status,
       idempotency_key_hash,request_hash,access_token_hash,terms_version,terms_accepted_at,payment_deadline,
       payment_obligation_id,payment_intent_id,payment_network,payment_receiving_address,payment_token_contract,payment_min_confirmations)
      VALUES ($1,$2,$3,$4,'Legacy Tester','legacy@example.test',$5,1,25,25,25,25,1,'test','payment_submitted',
       $6,$7,$8,'2026-08-01',now(),now()+interval '30 minutes',$9,$10,'bsc',
       '0x2222222222222222222222222222222222222222','0x1111111111111111111111111111111111111111',3)`,
    crypto.randomUUID(), reference, campaignId, invitationId, profileId,
    crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID(), intentId);
  }
  return { campaignId, invitationId, fulfilledIntentId, rejectedIntentId, fulfilledReference, rejectedReference };
}

describe("presale settlement consumption", () => {
  it("moves inventory once after settlement and releases a rejected reservation once", async () => {
    const seeded = await seedOrders();
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
    expect(campaign).toEqual({ reserved_shares: 0, sold_shares: 2 });
    expect(orders.map((row) => row.status)).toEqual(["cancelled", "confirmed"]);
    expect(invite).toEqual({ used_shares: 1, status: "active" });
  });
});
