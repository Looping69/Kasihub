// Author: Klaasvaakie ( |╲ )
import { api, APIError } from "encore.dev/api";
import { secret } from "encore.dev/config";
import { CronJob } from "encore.dev/cron";
import { z } from "zod";
import { presaleDb } from "../../resources";
import { requestHeader } from "../auth/access";
import { requireAdminAccess } from "../auth/access";
import {
  hashSecret,
  normalizeEmail,
  PaymentEvent,
  PRESALE_TERMS_VERSION,
  verifyPaymentEvent,
} from "./model";

const PresaleWebhookSecret = secret("PresaleWebhookSecret");

const campaignInput = z.object({
  slug: z.string().trim().min(2).max(80).regex(/^[a-z0-9-]+$/),
  name: z.string().trim().min(2).max(160),
  issuerName: z.string().trim().min(2).max(160),
  shareClass: z.string().trim().min(2).max(80).default("Class B"),
  status: z.enum(["draft", "active", "paused", "closed"]),
  totalShares: z.number().int().positive(),
  priceUsdt: z.number().positive(),
  network: z.string().trim().min(2).max(80),
  tokenContract: z.string().trim().max(160).optional(),
  receivingAddress: z.string().trim().min(8).max(200),
  minConfirmations: z.number().int().positive().max(10_000),
  paymentWindowMinutes: z.number().int().min(5).max(1_440).default(30),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
});

const orderInput = z.object({
  inviteToken: z.string().min(32).max(256),
  buyerName: z.string().trim().min(2).max(160),
  buyerEmail: z.string().email().max(254),
  buyerPhone: z.string().trim().max(40).optional(),
  quantity: z.number().int().positive().max(1_000_000),
  termsAccepted: z.literal(true),
});

const proofInput = z.object({
  orderReference: z.string().min(8).max(80),
  accessToken: z.string().min(32).max(256),
  txHash: z.string().trim().min(16).max(160),
  senderAddress: z.string().trim().max(200).optional(),
});

const paymentEventInput = z.object({
  eventId: z.string().trim().min(4).max(160),
  provider: z.string().trim().min(2).max(80),
  orderReference: z.string().trim().min(8).max(80).optional(),
  txHash: z.string().trim().min(16).max(160),
  network: z.string().trim().min(2).max(80),
  tokenContract: z.string().trim().max(160).optional(),
  receiverAddress: z.string().trim().min(8).max(200),
  senderAddress: z.string().trim().max(200).optional(),
  amountUsdt: z.number().positive(),
  confirmations: z.number().int().nonnegative(),
  blockNumber: z.string().trim().max(100).optional(),
});

type CampaignRow = {
  id: string;
  slug: string;
  name: string;
  issuer_name: string;
  share_class: string;
  status: string;
  total_shares: number;
  reserved_shares: number;
  sold_shares: number;
  price_usdt: string;
  network: string;
  token_contract: string | null;
  receiving_address: string;
  min_confirmations: number;
  payment_window_minutes: number;
  starts_at: string | null;
  ends_at: string | null;
};

type OrderRow = {
  id: string;
  order_reference: string;
  campaign_id: string;
  buyer_name: string;
  buyer_email: string;
  quantity: number;
  unit_price_usdt: string;
  total_usdt: string;
  status: string;
  payment_deadline: string;
  confirmed_at: string | null;
  incorporation_status: string;
  created_at: string;
};

interface PresaleOfferResponse {
  slug: string;
  name: string;
  issuerName: string;
  shareClass: string;
  priceUsdt: string;
  network: string;
  tokenContract?: string;
  receivingAddress: string;
  sharesRemaining: number;
  invitationSharesRemaining: number;
  invitationEmail?: string;
  minConfirmations: number;
  paymentWindowMinutes: number;
  termsVersion: string;
  startsAt?: string;
  endsAt?: string;
}

interface PresaleOrderResponse {
  orderReference: string;
  campaign: string;
  issuerName: string;
  shareClass: string;
  buyerName: string;
  buyerEmail: string;
  quantity: number;
  unitPriceUsdt: string;
  totalUsdt: string;
  status: string;
  network: string;
  tokenContract?: string;
  receivingAddress: string;
  minConfirmations: number;
  paymentDeadline: string;
  transactionHash?: string;
  confirmations: number;
  confirmedAt?: string;
  incorporationStatus: string;
  createdAt: string;
}

interface CreatePresaleOrderRequest {
  inviteToken: string;
  buyerName: string;
  buyerEmail: string;
  buyerPhone?: string;
  quantity: number;
  termsAccepted: boolean;
}

interface PresalePaymentProofRequest {
  orderReference: string;
  accessToken: string;
  txHash: string;
  senderAddress?: string;
}

interface PresalePaymentEventRequest {
  eventId: string;
  provider: string;
  orderReference?: string;
  txHash: string;
  network: string;
  tokenContract?: string;
  receiverAddress: string;
  senderAddress?: string;
  amountUsdt: number;
  confirmations: number;
  blockNumber?: string;
}

interface UpsertPresaleCampaignRequest {
  slug: string;
  name: string;
  issuerName: string;
  shareClass?: string;
  status: "draft" | "active" | "paused" | "closed";
  totalShares: number;
  priceUsdt: number;
  network: string;
  tokenContract?: string;
  receivingAddress: string;
  minConfirmations: number;
  paymentWindowMinutes?: number;
  startsAt?: string;
  endsAt?: string;
}

function sameAddress(left: string | null | undefined, right: string | null | undefined): boolean {
  return (left ?? "").trim().toLowerCase() === (right ?? "").trim().toLowerCase();
}

function orderResponse(order: OrderRow, campaign: CampaignRow, txHash?: string | null, confirmations = 0) {
  return {
    orderReference: order.order_reference,
    campaign: campaign.name,
    issuerName: campaign.issuer_name,
    shareClass: campaign.share_class,
    buyerName: order.buyer_name,
    buyerEmail: order.buyer_email,
    quantity: order.quantity,
    unitPriceUsdt: order.unit_price_usdt,
    totalUsdt: order.total_usdt,
    status: order.status,
    network: campaign.network,
    tokenContract: campaign.token_contract ?? undefined,
    receivingAddress: campaign.receiving_address,
    minConfirmations: campaign.min_confirmations,
    paymentDeadline: order.payment_deadline,
    transactionHash: txHash ?? undefined,
    confirmations,
    confirmedAt: order.confirmed_at ?? undefined,
    incorporationStatus: order.incorporation_status,
    createdAt: order.created_at,
  };
}

export const getPresaleOffer = api<
  { inviteToken: string },
  { offer: PresaleOfferResponse }
>({ method: "GET", path: "/presale/offer", expose: true }, async (req) => {
  if (!req.inviteToken || req.inviteToken.length < 32) throw APIError.permissionDenied("A valid private invitation is required");
  const row = await presaleDb.rawQueryRow<CampaignRow & { max_shares: number; used_shares: number; invitation_email: string | null }>(
    `SELECT c.*, i.max_shares, i.used_shares, i.email AS invitation_email
     FROM presale_invitations i JOIN presale_campaigns c ON c.id = i.campaign_id
     WHERE i.token_hash = $1 AND i.status = 'active' AND (i.expires_at IS NULL OR i.expires_at > now())
       AND c.status = 'active' AND (c.starts_at IS NULL OR c.starts_at <= now()) AND (c.ends_at IS NULL OR c.ends_at > now())`,
    hashSecret(req.inviteToken),
  );
  if (!row) throw APIError.permissionDenied("This invitation is invalid, expired, or the presale is not active");
  return { offer: offerResponse(row, row.max_shares - row.used_shares, row.invitation_email) };
});

function offerResponse(campaign: CampaignRow, invitationSharesRemaining: number, invitationEmail?: string | null): PresaleOfferResponse {
  return {
    slug: campaign.slug,
    name: campaign.name,
    issuerName: campaign.issuer_name,
    shareClass: campaign.share_class,
    priceUsdt: campaign.price_usdt,
    network: campaign.network,
    tokenContract: campaign.token_contract ?? undefined,
    receivingAddress: campaign.receiving_address,
    sharesRemaining: campaign.total_shares - campaign.reserved_shares - campaign.sold_shares,
    invitationSharesRemaining,
    invitationEmail: invitationEmail ?? undefined,
    minConfirmations: campaign.min_confirmations,
    paymentWindowMinutes: campaign.payment_window_minutes,
    termsVersion: PRESALE_TERMS_VERSION,
    startsAt: campaign.starts_at ?? undefined,
    endsAt: campaign.ends_at ?? undefined,
  };
}

export const createPresaleOrder = api<CreatePresaleOrderRequest, { order: PresaleOrderResponse; accessToken: string }>(
  { method: "POST", path: "/presale/orders", expose: true },
  async (request) => {
    const payload = orderInput.parse(request);
    const idempotencyKey = requestHeader("idempotency-key").trim();
    if (idempotencyKey.length < 16 || idempotencyKey.length > 200) throw APIError.invalidArgument("A valid Idempotency-Key is required");
    const inviteHash = hashSecret(payload.inviteToken);
    const idempotencyHash = hashSecret(idempotencyKey);
    const requestHash = hashSecret(JSON.stringify({
      inviteHash,
      buyerName: payload.buyerName,
      buyerEmail: normalizeEmail(payload.buyerEmail),
      buyerPhone: payload.buyerPhone ?? "",
      quantity: payload.quantity,
      termsVersion: PRESALE_TERMS_VERSION,
    }));
    const accessToken = crypto.randomUUID() + crypto.randomUUID();
    const tx = await presaleDb.begin();
    try {
      const invitation = await tx.rawQueryRow<{ id: string; campaign_id: string; email: string | null; max_shares: number; used_shares: number; status: string; expires_at: string | null }>(
        `SELECT id, campaign_id, email, max_shares, used_shares, status, expires_at
         FROM presale_invitations WHERE token_hash = $1 FOR UPDATE`, inviteHash);
      if (!invitation) throw APIError.permissionDenied("This invitation is invalid or expired");
      const replay = await tx.rawQueryRow<OrderRow & { request_hash: string }>(
        `SELECT id, order_reference, campaign_id, buyer_name, buyer_email, quantity, unit_price_usdt::text AS unit_price_usdt,
                total_usdt::text AS total_usdt, status, payment_deadline, confirmed_at, incorporation_status, created_at, request_hash
         FROM presale_orders WHERE invitation_id = $1 AND idempotency_key_hash = $2`, invitation.id, idempotencyHash);
      if (replay) {
        if (replay.request_hash !== requestHash) throw APIError.alreadyExists("Idempotency-Key was already used for a different order");
        await tx.rawExec("UPDATE presale_orders SET access_token_hash = $2, updated_at = now() WHERE id = $1", replay.id, hashSecret(accessToken));
        const campaign = await tx.rawQueryRow<CampaignRow>("SELECT * FROM presale_campaigns WHERE id = $1", replay.campaign_id);
        if (!campaign) throw new Error("presale_campaign_not_found");
        await tx.commit();
        return { order: orderResponse(replay, campaign), accessToken };
      }
      if (invitation.status !== "active" || (invitation.expires_at && new Date(invitation.expires_at) <= new Date())) {
        throw APIError.permissionDenied("This invitation is invalid or expired");
      }
      const email = normalizeEmail(payload.buyerEmail);
      if (invitation.email && normalizeEmail(invitation.email) !== email) throw APIError.permissionDenied("This invitation belongs to a different email address");
      if (invitation.used_shares + payload.quantity > invitation.max_shares) throw APIError.failedPrecondition("The invitation share limit would be exceeded");
      const campaign = await tx.rawQueryRow<CampaignRow>(
        `UPDATE presale_campaigns SET reserved_shares = reserved_shares + $2, updated_at = now()
         WHERE id = $1 AND status = 'active' AND (starts_at IS NULL OR starts_at <= now()) AND (ends_at IS NULL OR ends_at > now())
           AND reserved_shares + sold_shares + $2 <= total_shares RETURNING *`, invitation.campaign_id, payload.quantity);
      if (!campaign) throw APIError.failedPrecondition("The presale is closed or does not have enough shares remaining");
      await tx.rawExec(`UPDATE presale_invitations SET used_shares = used_shares + $2,
        status = CASE WHEN used_shares + $2 = max_shares THEN 'exhausted' ELSE status END WHERE id = $1`, invitation.id, payload.quantity);
      const orderId = crypto.randomUUID();
      const orderReference = `KSP-${crypto.randomUUID().slice(0, 8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
      const totalUsdt = (Number(campaign.price_usdt) * payload.quantity).toFixed(6);
      const order = await tx.rawQueryRow<OrderRow>(
        `INSERT INTO presale_orders
          (id, order_reference, campaign_id, invitation_id, buyer_name, buyer_email, buyer_phone, quantity,
           unit_price_usdt, total_usdt, idempotency_key_hash, request_hash, access_token_hash, terms_version,
           terms_accepted_at, payment_deadline)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::numeric,$10::numeric,$11,$12,$13,$14,now(),
                 now() + ($15::int * interval '1 minute'))
         RETURNING id, order_reference, campaign_id, buyer_name, buyer_email, quantity,
                   unit_price_usdt::text AS unit_price_usdt, total_usdt::text AS total_usdt, status,
                   payment_deadline, confirmed_at, incorporation_status, created_at`,
        orderId, orderReference, campaign.id, invitation.id, payload.buyerName.trim(), email, payload.buyerPhone?.trim() ?? null,
        payload.quantity, campaign.price_usdt, totalUsdt, idempotencyHash, requestHash, hashSecret(accessToken),
        PRESALE_TERMS_VERSION, campaign.payment_window_minutes);
      if (!order) throw new Error("presale_order_not_created");
      await tx.commit();
      return { order: orderResponse(order, campaign), accessToken };
    } catch (error) {
      await tx.rollback();
      throw error;
    }
  },
);

export const getPresaleOrder = api<
  { orderReference: string; accessToken: string },
  { order: PresaleOrderResponse }
>({ method: "GET", path: "/presale/orders/:orderReference", expose: true }, async (req) => {
  const row = await presaleDb.rawQueryRow<OrderRow & CampaignRow & { campaign_status: string; tx_hash: string | null; confirmations: number | null }>(
    `SELECT o.id, o.order_reference, o.campaign_id, o.buyer_name, o.buyer_email, o.quantity,
            o.unit_price_usdt::text AS unit_price_usdt, o.total_usdt::text AS total_usdt, o.status,
            o.payment_deadline, o.confirmed_at, o.incorporation_status, o.created_at,
            c.slug, c.name, c.issuer_name, c.share_class, c.status AS campaign_status, c.total_shares,
            c.reserved_shares, c.sold_shares, c.price_usdt::text AS price_usdt, c.network, c.token_contract,
            c.receiving_address, c.min_confirmations, c.payment_window_minutes, c.starts_at, c.ends_at,
            p.tx_hash, p.confirmations
     FROM presale_orders o JOIN presale_campaigns c ON c.id = o.campaign_id
     LEFT JOIN LATERAL (SELECT tx_hash, confirmations FROM presale_payments WHERE order_id = o.id ORDER BY created_at DESC LIMIT 1) p ON true
     WHERE o.order_reference = $1 AND o.access_token_hash = $2`, req.orderReference, hashSecret(req.accessToken));
  if (!row) throw APIError.notFound("Presale order not found");
  const campaign: CampaignRow = { ...row, status: row.campaign_status };
  return { order: orderResponse(row, campaign, row.tx_hash, row.confirmations ?? 0) };
});

export const submitPresalePaymentProof = api<PresalePaymentProofRequest, { orderReference: string; status: string; transactionHash: string }>(
  { method: "POST", path: "/presale/orders/:orderReference/payment-proof", expose: true },
  async (request) => {
    const payload = proofInput.parse(request);
    const order = await presaleDb.rawQueryRow<{ id: string; status: string; network: string; receiving_address: string; token_contract: string | null }>(
      `SELECT o.id, o.status, c.network, c.receiving_address, c.token_contract
       FROM presale_orders o JOIN presale_campaigns c ON c.id = o.campaign_id
       WHERE o.order_reference = $1 AND o.access_token_hash = $2`, payload.orderReference, hashSecret(payload.accessToken));
    if (!order) throw APIError.notFound("Presale order not found");
    if (["confirmed", "expired", "cancelled", "incorporated"].includes(order.status)) throw APIError.failedPrecondition("This order no longer accepts payment proof");
    const txHash = payload.txHash.toLowerCase();
    const claimed = await presaleDb.rawQueryRow<{ order_id: string }>("SELECT order_id FROM presale_payments WHERE tx_hash = $1", txHash);
    if (claimed && claimed.order_id !== order.id) throw APIError.alreadyExists("This transaction hash is already assigned to another order");
    const payment = await presaleDb.rawQueryRow<{ id: string }>(
      `INSERT INTO presale_payments (order_id, network, tx_hash, sender_address, receiver_address, token_contract)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (order_id) DO UPDATE SET tx_hash = EXCLUDED.tx_hash, sender_address = EXCLUDED.sender_address, updated_at = now()
       WHERE presale_payments.status = 'submitted'
       RETURNING id`, order.id, order.network, txHash, payload.senderAddress ?? null, order.receiving_address, order.token_contract);
    if (!payment) throw APIError.failedPrecondition("A detected payment proof cannot be replaced");
    await presaleDb.rawExec(`UPDATE presale_orders SET status = CASE WHEN status = 'awaiting_payment' THEN 'payment_submitted' ELSE status END,
      updated_at = now() WHERE id = $1`, order.id);
    return { orderReference: payload.orderReference, status: "payment_submitted", transactionHash: txHash };
  },
);

export const receivePresalePaymentEvent = api<PresalePaymentEventRequest, { accepted: true; outcome: string; orderReference?: string }>(
  { method: "POST", path: "/presale/webhooks/usdt", expose: true },
  async (request) => {
    const event = paymentEventInput.parse(request) as PaymentEvent;
    const signature = requestHeader("x-presale-signature").trim();
    if (!verifyPaymentEvent(event, PresaleWebhookSecret(), signature)) throw APIError.unauthenticated("Invalid presale webhook signature");
    const tx = await presaleDb.begin();
    try {
      const inserted = await tx.rawQueryRow<{ id: string }>(
        `INSERT INTO presale_payment_events (provider, provider_event_id, tx_hash, payload, outcome)
         VALUES ($1,$2,$3,$4::jsonb,'processing') ON CONFLICT (provider, provider_event_id) DO NOTHING RETURNING id`,
        event.provider, event.eventId, event.txHash.toLowerCase(), JSON.stringify(event));
      if (!inserted) {
        const prior = await tx.rawQueryRow<{ outcome: string }>(
          "SELECT outcome FROM presale_payment_events WHERE provider = $1 AND provider_event_id = $2", event.provider, event.eventId);
        await tx.commit();
        return { accepted: true, outcome: prior?.outcome ?? "duplicate" };
      }
      const context = await tx.rawQueryRow<{
        payment_id: string | null; payment_tx_hash: string | null; order_id: string; order_reference: string; order_status: string; quantity: number; total_usdt: string;
        campaign_id: string; network: string; token_contract: string | null; receiving_address: string; min_confirmations: number;
      }>(
        `SELECT p.id AS payment_id, p.tx_hash AS payment_tx_hash, o.id AS order_id, o.order_reference, o.status AS order_status, o.quantity,
                o.total_usdt::text AS total_usdt, c.id AS campaign_id, c.network, c.token_contract,
                c.receiving_address, c.min_confirmations
         FROM presale_orders o JOIN presale_campaigns c ON c.id = o.campaign_id
         LEFT JOIN presale_payments p ON p.order_id = o.id
         WHERE ($2 <> '' AND o.order_reference = $2) OR p.tx_hash = $1
         ORDER BY CASE WHEN p.tx_hash = $1 THEN 0 ELSE 1 END LIMIT 1 FOR UPDATE OF o`,
        event.txHash.toLowerCase(), event.orderReference ?? "");
      if (!context) throw APIError.notFound("No presale order matches this payment event");
      if (["expired", "cancelled", "incorporated"].includes(context.order_status)) throw APIError.failedPrecondition("The linked order cannot accept this payment");
      if (context.payment_tx_hash && context.payment_tx_hash !== event.txHash.toLowerCase()) {
        throw APIError.failedPrecondition("The event transaction does not match the order payment proof");
      }
      if (!sameAddress(context.network, event.network) || !sameAddress(context.receiving_address, event.receiverAddress)
        || !sameAddress(context.token_contract, event.tokenContract)) throw APIError.failedPrecondition("Payment asset, network, or receiver does not match the order");
      if (event.amountUsdt + 0.0000001 < Number(context.total_usdt)) throw APIError.failedPrecondition("Payment amount is below the order total");
      let paymentId = context.payment_id;
      if (!paymentId) {
        paymentId = crypto.randomUUID();
        await tx.rawExec(`INSERT INTO presale_payments
          (id, order_id, network, tx_hash, sender_address, receiver_address, token_contract, amount_usdt, confirmations, status, provider, block_number, detected_at)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8::numeric,$9,'detected',$10,$11,now())`,
          paymentId, context.order_id, event.network, event.txHash.toLowerCase(), event.senderAddress ?? null,
          event.receiverAddress, event.tokenContract ?? null, event.amountUsdt.toFixed(6), event.confirmations, event.provider, event.blockNumber ?? null);
      }
      const confirmed = event.confirmations >= context.min_confirmations;
      await tx.rawExec(`UPDATE presale_payments SET amount_usdt = GREATEST(COALESCE(amount_usdt, 0), $2::numeric), confirmations = GREATEST(confirmations, $3),
        status = CASE WHEN status = 'confirmed' THEN status WHEN $4 THEN 'confirmed' ELSE 'detected' END, provider = $5, block_number = COALESCE($6, block_number),
        sender_address = COALESCE($7, sender_address), detected_at = COALESCE(detected_at, now()),
        confirmed_at = CASE WHEN $4 THEN COALESCE(confirmed_at, now()) ELSE confirmed_at END, updated_at = now() WHERE id = $1`,
        paymentId, event.amountUsdt.toFixed(6), event.confirmations, confirmed, event.provider, event.blockNumber ?? null, event.senderAddress ?? null);
      let outcome = "detected";
      if (confirmed && context.order_status !== "confirmed") {
        await tx.rawExec(`UPDATE presale_campaigns SET reserved_shares = reserved_shares - $2,
          sold_shares = sold_shares + $2, updated_at = now() WHERE id = $1`, context.campaign_id, context.quantity);
        await tx.rawExec("UPDATE presale_orders SET status = 'confirmed', confirmed_at = now(), updated_at = now() WHERE id = $1", context.order_id);
        outcome = "confirmed";
      } else if (!confirmed && context.order_status !== "confirmed") {
        await tx.rawExec("UPDATE presale_orders SET status = 'payment_detected', updated_at = now() WHERE id = $1", context.order_id);
      } else if (context.order_status === "confirmed") {
        outcome = "already_confirmed";
      }
      await tx.rawExec("UPDATE presale_payment_events SET outcome = $2 WHERE id = $1", inserted.id, outcome);
      await tx.commit();
      return { accepted: true, outcome, orderReference: context.order_reference };
    } catch (error) {
      await tx.rollback();
      throw error;
    }
  },
);

export const upsertPresaleCampaign = api<UpsertPresaleCampaignRequest, { campaignId: string; status: string }>(
  { method: "POST", path: "/admin/presale/campaigns", expose: true },
  async (request) => {
    await requireAdminAccess();
    const payload = campaignInput.parse(request);
    if (payload.endsAt && payload.startsAt && new Date(payload.endsAt) <= new Date(payload.startsAt)) throw APIError.invalidArgument("Campaign end must be after its start");
    if (payload.status === "active" && !payload.tokenContract) throw APIError.invalidArgument("An active USDT campaign requires the exact token contract");
    const row = await presaleDb.rawQueryRow<{ id: string; status: string }>(
      `INSERT INTO presale_campaigns
        (slug,name,issuer_name,share_class,status,total_shares,price_usdt,network,token_contract,receiving_address,
         min_confirmations,payment_window_minutes,starts_at,ends_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7::numeric,$8,$9,$10,$11,$12,$13,$14)
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, issuer_name = EXCLUDED.issuer_name,
         share_class = EXCLUDED.share_class, status = EXCLUDED.status,
         total_shares = EXCLUDED.total_shares, price_usdt = EXCLUDED.price_usdt, network = EXCLUDED.network,
         token_contract = EXCLUDED.token_contract, receiving_address = EXCLUDED.receiving_address,
         min_confirmations = EXCLUDED.min_confirmations, payment_window_minutes = EXCLUDED.payment_window_minutes,
         starts_at = EXCLUDED.starts_at, ends_at = EXCLUDED.ends_at, updated_at = now()
       WHERE presale_campaigns.total_shares >= presale_campaigns.reserved_shares + presale_campaigns.sold_shares
         AND EXCLUDED.total_shares >= presale_campaigns.reserved_shares + presale_campaigns.sold_shares
       RETURNING id, status`,
      payload.slug, payload.name, payload.issuerName, payload.shareClass, payload.status, payload.totalShares,
      payload.priceUsdt.toFixed(6), payload.network, payload.tokenContract ?? null, payload.receivingAddress,
      payload.minConfirmations, payload.paymentWindowMinutes, payload.startsAt ?? null, payload.endsAt ?? null);
    if (!row) throw APIError.failedPrecondition("Total shares cannot be lower than current reserved and sold shares");
    return { campaignId: row.id, status: row.status };
  },
);

export const createPresaleInvitation = api<
  { campaignId: string; email?: string; maxShares: number; expiresAt?: string },
  { invitationId: string; inviteToken: string }
>({ method: "POST", path: "/admin/presale/invitations", expose: true }, async (req) => {
  await requireAdminAccess();
  if (!Number.isInteger(req.maxShares) || req.maxShares < 1) throw APIError.invalidArgument("maxShares must be a positive integer");
  if (req.expiresAt && new Date(req.expiresAt) <= new Date()) throw APIError.invalidArgument("Invitation expiry must be in the future");
  const inviteToken = crypto.randomUUID() + crypto.randomUUID();
  const invitationId = crypto.randomUUID();
  const row = await presaleDb.rawQueryRow<{ id: string }>(
    `INSERT INTO presale_invitations (id,campaign_id,token_hash,email,max_shares,expires_at)
     SELECT $1,id,$2,$3,$4,$5 FROM presale_campaigns WHERE id = $6 RETURNING id`,
    invitationId, hashSecret(inviteToken), req.email ? normalizeEmail(req.email) : null, req.maxShares, req.expiresAt ?? null, req.campaignId);
  if (!row) throw APIError.notFound("Presale campaign not found");
  return { invitationId, inviteToken };
});

export const listPresaleOrders = api<
  { campaignId: string; status?: string; limit?: number },
  { orders: Array<{ orderReference: string; buyerName: string; buyerEmail: string; quantity: number; totalUsdt: string; status: string; txHash?: string; confirmations: number; incorporationStatus: string; createdAt: string }> }
>({ method: "GET", path: "/admin/presale/orders", expose: true }, async (req) => {
  await requireAdminAccess();
  const rows = await presaleDb.rawQueryAll<OrderRow & { tx_hash: string | null; confirmations: number | null }>(
    `SELECT o.id,o.order_reference,o.campaign_id,o.buyer_name,o.buyer_email,o.quantity,
            o.unit_price_usdt::text AS unit_price_usdt,o.total_usdt::text AS total_usdt,o.status,
            o.payment_deadline,o.confirmed_at,o.incorporation_status,o.created_at,p.tx_hash,p.confirmations
     FROM presale_orders o
     LEFT JOIN LATERAL (SELECT tx_hash, confirmations FROM presale_payments WHERE order_id = o.id ORDER BY created_at DESC LIMIT 1) p ON true
     WHERE o.campaign_id = $1 AND ($2 = '' OR o.status = $2) ORDER BY o.created_at DESC LIMIT $3`,
    req.campaignId, req.status ?? "", Math.min(Math.max(req.limit ?? 100, 1), 500));
  return { orders: rows.map((row) => ({ orderReference: row.order_reference, buyerName: row.buyer_name, buyerEmail: row.buyer_email,
    quantity: row.quantity, totalUsdt: row.total_usdt, status: row.status, txHash: row.tx_hash ?? undefined,
    confirmations: row.confirmations ?? 0, incorporationStatus: row.incorporation_status, createdAt: row.created_at })) };
});

export const preparePresaleIncorporation = api<
  { campaignId: string },
  { batchId: string; manifestHash: string; orders: Array<{ presaleOrderId: string; orderReference: string; buyerName: string; buyerEmail: string; quantity: number; paidUsdt: string; transactionHash: string }> }
>({ method: "POST", path: "/admin/presale/incorporation-batches", expose: true }, async (req) => {
  const admin = await requireAdminAccess();
  const tx = await presaleDb.begin();
  try {
    const rows = await tx.rawQueryAll<{ id: string; order_reference: string; buyer_name: string; buyer_email: string; quantity: number; total_usdt: string; tx_hash: string }>(
      `SELECT o.id,o.order_reference,o.buyer_name,o.buyer_email,o.quantity,o.total_usdt::text AS total_usdt,p.tx_hash
       FROM presale_orders o
       JOIN LATERAL (SELECT tx_hash FROM presale_payments WHERE order_id = o.id AND status = 'confirmed' ORDER BY confirmed_at LIMIT 1) p ON true
       WHERE o.campaign_id = $1 AND o.status = 'confirmed' AND o.incorporation_status = 'pending'
       ORDER BY o.created_at,o.id FOR UPDATE OF o`, req.campaignId);
    if (rows.length === 0) throw APIError.failedPrecondition("No confirmed presale orders are ready for incorporation");
    const orders = rows.map((row) => ({ presaleOrderId: row.id, orderReference: row.order_reference, buyerName: row.buyer_name,
      buyerEmail: row.buyer_email, quantity: row.quantity, paidUsdt: row.total_usdt, transactionHash: row.tx_hash }));
    const manifestHash = hashSecret(JSON.stringify(orders));
    const batchId = crypto.randomUUID();
    const totalShares = rows.reduce((sum, row) => sum + row.quantity, 0);
    const totalUsdt = rows.reduce((sum, row) => sum + Number(row.total_usdt), 0).toFixed(6);
    await tx.rawExec(`INSERT INTO presale_incorporation_batches
      (id,campaign_id,order_count,total_shares,total_usdt,manifest_hash,created_by)
      VALUES ($1,$2,$3,$4,$5::numeric,$6,$7)`, batchId, req.campaignId, rows.length, totalShares, totalUsdt, manifestHash, admin.user.id);
    await tx.rawExec(`UPDATE presale_orders SET incorporation_status = 'batched', incorporation_batch_id = $2, updated_at = now()
      WHERE id = ANY($1::uuid[])`, rows.map((row) => row.id), batchId);
    await tx.commit();
    return { batchId, manifestHash, orders };
  } catch (error) {
    await tx.rollback();
    throw error;
  }
});

export const expirePresaleOrders = api<void, { expired: number }>(
  { method: "POST", path: "/internal/presale/expire-orders", expose: false },
  async () => {
    const tx = await presaleDb.begin();
    try {
      const rows = await tx.rawQueryAll<{ id: string; campaign_id: string; invitation_id: string; quantity: number }>(
        `UPDATE presale_orders SET status = 'expired', updated_at = now()
         WHERE status = 'awaiting_payment' AND payment_deadline < now()
         RETURNING id,campaign_id,invitation_id,quantity`);
      for (const row of rows) {
        await tx.rawExec("UPDATE presale_campaigns SET reserved_shares = reserved_shares - $2, updated_at = now() WHERE id = $1", row.campaign_id, row.quantity);
        await tx.rawExec(`UPDATE presale_invitations SET used_shares = used_shares - $2,
          status = CASE WHEN status = 'exhausted' THEN 'active' ELSE status END WHERE id = $1`, row.invitation_id, row.quantity);
      }
      await tx.commit();
      return { expired: rows.length };
    } catch (error) {
      await tx.rollback();
      throw error;
    }
  },
);

const presaleExpiryJob = new CronJob("presale-order-expiry", {
  title: "Release expired presale reservations",
  every: "5m",
  endpoint: expirePresaleOrders,
});
void presaleExpiryJob;
