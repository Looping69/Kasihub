// Author: Klaasvaakie ( |╲ )
import { api, APIError } from "encore.dev/api";
import { secret } from "encore.dev/config";
import { CronJob } from "encore.dev/cron";
import * as log from "encore.dev/log";
import { createCipheriv, createDecipheriv, createHash as createNodeHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { identityDb, kycDb, presaleDb, sharesDb } from "../../resources";
import { hashSessionToken, requestHeader, requirePresaleSession } from "../auth/access";
import { requireAdminAccess } from "../auth/access";
import { hashPassword, verifyPassword } from "../auth/password";
import { requireInternationalKycVerified } from "../kyc/policy";
import { submitPaymentAttempt } from "../payments/attempts";
import { createPaymentIntent, type PaymentIntentResponse } from "../payments/intents";
import { cancelPaymentObligation, createPaymentObligation } from "../payments/obligations";
import { resolveActiveReceivingConfiguration } from "../payments/registry";
import {
  ensurePaymentRehearsalWallet,
  paymentRehearsalAllowed,
  readPaymentRehearsalEvidence,
  recordPaymentRehearsal,
} from "../payments/rehearsal";
import { verifyAndSettlePaymentAttempt } from "../payments/verification";
import {
  hashSecret,
  normalizeEmail,
  PaymentEvent,
  INVESTOR_APPLICATION_VERSION,
  PRESALE_TERMS_VERSION,
  verifyPaymentEvent,
} from "./model";
import { exceedsInvitationShareLimit } from "./invitation-policy";
import { issuedSharesForPresale, quotedUsdtAmount } from "./settlement";
import { INVESTOR_APPLICATION_SCHEMA_VERSION, phaseOneApplicantSchema, type PhaseOneApplicant } from "./application";
import { deriveApplicantContinuation, type ApplicantContinuationReason } from "./applicant-continuation";
import { databaseBinaryToBuffer, type DatabaseBinary } from "./database-binary";
import { WEBPAY_UNIT_PRICE_ZAR, verifyWebPayChecksum, verifyWebPayProcessChecksum, webPayChecksum, webPayMerchantFields, webPayOrderNumber, webPayTotalZar, type PresalePaymentRail } from "./webpay";
import { buildShareholderPortfolio, type PresaleCertificate, type PresalePaidOrder } from "./shareholder-portfolio";

const PresaleWebhookSecret = secret("PresaleWebhookSecret");
const InvestorApplicationEncryptionKey = secret("InvestorApplicationEncryptionKey");
const ResendApiKey = secret("RESEND_API_KEY");
const ResendFromEmail = secret("RESEND_FROM_EMAIL");
const WebPayMerchantUuid = secret("WEBPAY_MERCHANT_UUID");
const WebPayAccountUuid = secret("WEBPAY_ACCOUNT_UUID");
const WebPaySecurityKey = secret("WEBPAY_SECURITY_KEY");
const WebPayCheckoutUrl = secret("WEBPAY_CHECKOUT_URL");
const WebPayNotifyUrl = secret("WEBPAY_NOTIFY_URL");
const WebPaySiteId = secret("WEBPAY_SITE_ID");

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[character] ?? character);
}

async function attemptPresaleAccountCreatedEmail(input: {
  deliveryId: string; applicationId: string; profileId: string; recipient: string; legalName: string;
}): Promise<"sent" | "failed"> {
  const portalUrl = "https://shares.kasihub.net/shares/account";
  const name = escapeHtml(input.legalName);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ResendApiKey()}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `presale-account-created/${input.profileId}`,
    },
    body: JSON.stringify({
      from: ResendFromEmail(),
      to: [input.recipient],
      subject: "Your KaSiShares applicant account is ready",
      html: `<!doctype html><html lang="en"><body style="margin:0;background:#071a2f;font-family:Arial,sans-serif;color:#f8fafc"><div style="display:none;max-height:0;overflow:hidden">Continue your KaSiShares application and track identity verification.</div><div style="max-width:600px;margin:0 auto;padding:32px 20px"><div style="border:1px solid #334155;border-radius:18px;background:#0f2744;padding:32px"><h1 style="margin:0 0 18px;color:#fbbf24;font-size:26px">Your applicant account is ready</h1><p style="font-size:16px;line-height:1.6">Hello ${name},</p><p style="font-size:16px;line-height:1.6">You completed account creation for the private KaSiShares application. Your applicant space is separate from the normal KaSiHub member dashboard.</p><p style="font-size:16px;line-height:1.6">Use it to continue your application, view identity-verification progress, and return to the next incomplete step.</p><p style="margin:28px 0"><a href="${portalUrl}" style="display:inline-block;box-sizing:border-box;border-radius:10px;background:#fbbf24;color:#071a2f;padding:14px 22px;font-weight:700;text-decoration:none">Open my KaSiShares account</a></p><p style="font-size:13px;line-height:1.6;color:#cbd5e1">If you did not create this account, contact KaSiHub support. Never send payment based only on an email.</p></div></div></body></html>`,
      text: `Hello ${input.legalName},\n\nYou completed account creation for the private KaSiShares application. Your applicant space is separate from the normal KaSiHub member dashboard.\n\nContinue your application and track identity verification at: ${portalUrl}\n\nIf you did not create this account, contact KaSiHub support. Never send payment based only on an email.`,
      tags: [{ name: "email_type", value: "presale_account_created" }],
    }),
  });
  const result = await response.json().catch(() => null) as { id?: string; name?: string } | null;
  if (!response.ok || !result?.id) {
    await presaleDb.rawExec(
      `UPDATE presale_email_deliveries SET status = 'failed', attempt_count = attempt_count + 1,
         last_error_code = $2, updated_at = now() WHERE id = $1`,
      input.deliveryId, result?.name ?? `http_${response.status}`,
    );
    return "failed";
  }
  await presaleDb.rawExec(
    `UPDATE presale_email_deliveries SET status = 'sent', provider_message_id = $2,
       attempt_count = attempt_count + 1, last_error_code = NULL, sent_at = now(), updated_at = now()
     WHERE id = $1`,
    input.deliveryId, result.id,
  );
  return "sent";
}

async function sendPresaleAccountCreatedEmail(input: {
  deliveryId: string; applicationId: string; profileId: string; recipient: string; legalName: string;
}): Promise<"sent" | "failed"> {
  try {
    return await attemptPresaleAccountCreatedEmail(input);
  } catch {
    await presaleDb.rawExec(
      `UPDATE presale_email_deliveries SET status = 'failed', attempt_count = attempt_count + 1,
         last_error_code = 'provider_unavailable', updated_at = now() WHERE id = $1`,
      input.deliveryId,
    );
    return "failed";
  }
}

async function sendPresaleReservationCreatedEmail(input: {
  deliveryId: string;
  orderId: string;
  recipient: string;
  buyerName: string;
  orderReference: string;
  campaignName: string;
  quantity: number;
  amountLabel: string;
  paymentMethod: string;
  paymentDeadline: string;
}): Promise<"sent" | "failed"> {
  const orderUrl = "https://shares.kasihub.net/shares/account";
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ResendApiKey()}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `presale-reservation-created/${input.orderId}`,
      },
      body: JSON.stringify({
        from: ResendFromEmail(),
        to: [input.recipient],
        subject: `KaSiShares reservation ${input.orderReference} created`,
        html: `<!doctype html><html lang="en"><body style="margin:0;background:#071a2f;font-family:Arial,sans-serif;color:#f8fafc"><div style="display:none;max-height:0;overflow:hidden">Your KaSiShares reservation has been created. Review the payment instructions in your secure account.</div><div style="max-width:600px;margin:0 auto;padding:32px 20px"><div style="border:1px solid #334155;border-radius:18px;background:#0f2744;padding:32px"><h1 style="margin:0 0 18px;color:#fbbf24;font-size:26px">Reservation created</h1><p style="font-size:16px;line-height:1.6">Hello ${escapeHtml(input.buyerName)},</p><p style="font-size:16px;line-height:1.6">Your reservation for ${input.quantity} ${input.quantity === 1 ? "share" : "shares"} in ${escapeHtml(input.campaignName)} has been created.</p><p style="font-size:15px;line-height:1.8"><strong>Reference:</strong> ${escapeHtml(input.orderReference)}<br><strong>Amount:</strong> ${escapeHtml(input.amountLabel)}<br><strong>Payment method:</strong> ${escapeHtml(input.paymentMethod)}<br><strong>Payment deadline:</strong> ${escapeHtml(input.paymentDeadline)}</p><p style="margin:28px 0"><a href="${orderUrl}" style="display:inline-block;box-sizing:border-box;border-radius:10px;background:#fbbf24;color:#071a2f;padding:14px 22px;font-weight:700;text-decoration:none">Open my KaSiShares account</a></p><p style="font-size:13px;line-height:1.6;color:#cbd5e1">This email confirms a reservation, not payment or share ownership. Use only the payment instructions shown inside your secure KaSiShares session. Never send funds based only on an email.</p></div></div></body></html>`,
        text: `Hello ${input.buyerName},\n\nYour reservation for ${input.quantity} ${input.quantity === 1 ? "share" : "shares"} in ${input.campaignName} has been created.\n\nReference: ${input.orderReference}\nAmount: ${input.amountLabel}\nPayment method: ${input.paymentMethod}\nPayment deadline: ${input.paymentDeadline}\n\nOpen your secure KaSiShares account to review payment instructions: ${orderUrl}\n\nThis confirms a reservation, not payment or share ownership. Never send funds based only on an email.`,
        tags: [{ name: "email_type", value: "presale_reservation_created" }],
      }),
    });
    const result = await response.json().catch(() => null) as { id?: string; name?: string } | null;
    if (!response.ok || !result?.id) {
      await presaleDb.rawExec(
        `UPDATE presale_email_deliveries SET status = 'failed', attempt_count = attempt_count + 1,
           last_error_code = $2, updated_at = now() WHERE id = $1`,
        input.deliveryId, result?.name ?? `http_${response.status}`,
      );
      return "failed";
    }
    await presaleDb.rawExec(
      `UPDATE presale_email_deliveries SET status = 'sent', provider_message_id = $2,
         attempt_count = attempt_count + 1, last_error_code = NULL, sent_at = now(), updated_at = now()
       WHERE id = $1`,
      input.deliveryId, result.id,
    );
    return "sent";
  } catch {
    await presaleDb.rawExec(
      `UPDATE presale_email_deliveries SET status = 'failed', attempt_count = attempt_count + 1,
         last_error_code = 'provider_unavailable', updated_at = now() WHERE id = $1`,
      input.deliveryId,
    );
    return "failed";
  }
}

async function ensurePresaleReservationCreatedEmail(order: OrderRow, campaign: CampaignRow, network: string): Promise<"sent" | "failed" | "existing"> {
  const delivery = await presaleDb.rawQueryRow<{ id: string; status: string }>(
    `INSERT INTO presale_email_deliveries
       (id, external_profile_id, order_id, email_type, recipient_email, status)
     VALUES ($1,$2,$3,'reservation_created',$4,'pending')
     ON CONFLICT (order_id, email_type) WHERE order_id IS NOT NULL DO UPDATE
       SET recipient_email = EXCLUDED.recipient_email
     RETURNING id, status`,
    crypto.randomUUID(), order.external_profile_id, order.id, order.buyer_email,
  );
  if (!delivery || delivery.status === "sent") return "existing";
  return sendPresaleReservationCreatedEmail({
    deliveryId: delivery.id,
    orderId: order.id,
    recipient: order.buyer_email,
    buyerName: order.buyer_name,
    orderReference: order.order_reference,
    campaignName: campaign.name,
    quantity: order.quantity,
    amountLabel: order.payment_rail === "webpay_card" ? `R${order.total_zar}` : `${order.total_usdt} USDT`,
    paymentMethod: order.payment_rail === "webpay_card" ? "WebPay debit or credit card" : `Remitano / USDT on ${network}`,
    paymentDeadline: order.payment_deadline,
  });
}

async function safelyEnsurePresaleReservationCreatedEmail(order: OrderRow, campaign: CampaignRow, network: string): Promise<"sent" | "failed" | "existing"> {
  try {
    return await ensurePresaleReservationCreatedEmail(order, campaign, network);
  } catch (error) {
    // A committed financial reservation must never be reported as failed because an ancillary email could not be queued.
    log.error(error, "presale reservation email could not be queued", { orderId: order.id });
    return "failed";
  }
}

function encryptInvestorApplication(value: unknown): { ciphertext: Buffer; nonce: Buffer; authTag: Buffer } {
  const key = createNodeHash("sha256").update(InvestorApplicationEncryptionKey()).digest();
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return { ciphertext, nonce, authTag: cipher.getAuthTag() };
}

const campaignInput = z.object({
  slug: z.string().trim().min(2).max(80).regex(/^[a-z0-9-]+$/),
  name: z.string().trim().min(2).max(160),
  issuerName: z.string().trim().min(2).max(160),
  shareClass: z.string().trim().min(2).max(80).default("Class B"),
  status: z.enum(["draft", "active", "paused", "closed"]),
  totalShares: z.number().int().positive(),
  priceUsd: z.number().positive(),
  usdtPerUsd: z.number().positive().max(10),
  sharePhaseNumber: z.number().int().positive().max(10_000).default(1),
  network: z.enum(["tron", "bsc"]),
  tokenContract: z.string().trim().max(160).optional(),
  receivingAddress: z.string().trim().min(8).max(200).optional(),
  minConfirmations: z.number().int().positive().max(10_000),
  paymentWindowMinutes: z.number().int().min(5).max(1_440).default(30),
  bonusBuyOneGet: z.boolean().default(false),
  isMock: z.boolean().default(false),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
});

const orderInput = z.object({
  inviteToken: z.string().min(32).max(256),
  buyerName: z.string().trim().min(2).max(160),
  buyerEmail: z.string().email().max(254),
  buyerPhone: z.string().trim().max(40).optional(),
  quantity: z.number().int().positive().max(1_000_000),
  paymentRail: z.enum(["remitano_usdt", "webpay_card"]).default("remitano_usdt"),
  termsAccepted: z.literal(true),
  investorApplication: z.object({
    applicantType: z.enum(["individual", "company", "trust"]),
    // KYC identity evidence is verified by the selected KYC authority, not duplicated in this reservation. Author: Klaasvaakie ( |╲ )
    dateOfBirth: z.string().trim().max(20).optional(),
    nationality: z.string().trim().min(2).max(100).optional(),
    occupation: z.string().trim().max(160).optional(),
    employer: z.string().trim().max(200).optional(),
    countryOfResidence: z.string().trim().min(2).max(100),
    physicalAddress: z.string().trim().min(5).max(500),
    confirmMobileNumber: z.string().trim().min(5).max(40),
    taxNumber: z.string().trim().max(100).optional(),
    taxResidenceCountry: z.string().trim().min(2).max(100).optional(),
    tin: z.string().trim().max(100).optional(),
    additionalTaxJurisdictions: z.string().trim().max(500).optional(),
    entityRegistrationNumber: z.string().trim().max(100).optional(),
    vatNumber: z.string().trim().max(100).optional(),
    authorisedRepresentativeName: z.string().trim().max(200).optional(),
    authorisedRepresentativePosition: z.string().trim().max(160).optional(),
    beneficialOwnerName: z.string().trim().min(2).max(200).optional(),
    beneficialOwnerRelationship: z.string().trim().max(160).optional(),
    sourceOfFunds: z.enum(["salary", "business", "investment", "property_sale", "inheritance", "pension", "savings", "company", "trust", "other"]).optional(),
    sourceOfFundsDetails: z.string().trim().min(2).max(1000).optional(),
    fundsOwnership: z.enum(["own", "company", "trust", "other"]).optional(),
    bankAccountHolder: z.string().trim().min(2).max(200).optional(),
    bankName: z.string().trim().min(2).max(160).optional(),
    bankBranch: z.string().trim().max(160).optional(),
    bankAccountNumber: z.string().trim().min(4).max(100).optional(),
    bankAccountType: z.string().trim().max(80).optional(),
    bankSwift: z.string().trim().max(20).optional(),
    amlDeclarationAccepted: z.literal(true),
    suitabilityDeclarationAccepted: z.literal(true),
    informationDeclarationAccepted: z.literal(true),
  }),
}).superRefine((value, context) => {
  const buyerPhone = value.buyerPhone?.trim();
  const confirmPhone = value.investorApplication.confirmMobileNumber.trim();

  if (!buyerPhone) {
    context.addIssue({ code: "custom", path: ["buyerPhone"], message: "Cellphone number is required" });
  } else if (buyerPhone !== confirmPhone) {
    context.addIssue({ code: "custom", path: ["investorApplication", "confirmMobileNumber"], message: "Cellphone numbers must match" });
  }

  for (const field of ["nationality", "occupation", "employer", "taxNumber"] as const) {
    if (!value.investorApplication[field]?.trim()) {
      context.addIssue({ code: "custom", path: ["investorApplication", field], message: "This field is required" });
    }
  }

  if (value.investorApplication.applicantType !== "individual") {
    for (const field of ["entityRegistrationNumber", "authorisedRepresentativeName", "authorisedRepresentativePosition"] as const) {
      if (!value.investorApplication[field]?.trim()) {
        context.addIssue({ code: "custom", path: ["investorApplication", field], message: "This field is required" });
      }
    }
  }
});

const createApplicationInput = z.object({
  inviteToken: z.string().min(32).max(256),
  applicantType: z.enum(["individual", "company", "trust"]),
});

const registerPresaleMemberInput = z.object({
  inviteToken: z.string().min(32).max(256),
  email: z.string().email().max(254),
  password: z.string().min(12).max(128),
  legalName: z.string().trim().min(2).max(300),
  phone: z.string().trim().min(5).max(40),
  applicantType: z.enum(["individual", "company", "trust"]),
  nationality: z.string().trim().min(2).max(100),
  countryOfResidence: z.string().trim().min(2).max(100),
  physicalAddress: z.string().trim().min(5).max(500),
});

const saveApplicationPhaseInput = z.object({
  applicationId: z.string().uuid(),
  phase: z.coerce.number().int().min(1).max(1),
  rowVersion: z.number().int().positive(),
  payload: phaseOneApplicantSchema,
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
  price_usd: string;
  usdt_per_usd: string;
  share_phase_number: number;
  network: string;
  token_contract: string | null;
  receiving_address: string | null;
  min_confirmations: number;
  payment_window_minutes: number;
  bonus_buy_one_get_one: boolean;
  is_mock: boolean;
  starts_at: string | null;
  ends_at: string | null;
};

type OrderRow = {
  id: string;
  order_reference: string;
  campaign_id: string;
  buyer_name: string;
  buyer_email: string;
  external_profile_id: string | null;
  quantity: number;
  payment_rail: PresalePaymentRail;
  unit_price_zar: string | null;
  total_zar: string | null;
  unit_price_usdt: string;
  total_usdt: string;
  unit_price_usd: string;
  total_usd: string;
  usdt_per_usd: string;
  quote_reference: string;
  status: string;
  payment_deadline: string;
  confirmed_at: string | null;
  incorporation_status: string;
  payment_obligation_id: string | null;
  payment_intent_id: string | null;
  payment_network: string | null;
  payment_receiving_address: string | null;
  payment_token_contract: string | null;
  payment_min_confirmations: number | null;
  payment_settled_at: string | null;
  created_at: string;
};

interface PresaleOfferResponse {
  slug: string;
  name: string;
  issuerName: string;
  shareClass: string;
  priceUsdt: string;
  priceUsd: string;
  webPayUnitPriceZar: string;
  usdtPerUsd: string;
  network: string;
  tokenContract?: string;
  receivingAddress?: string;
  sharesRemaining: number;
  invitationSharesRemaining: number;
  invitationEmail?: string;
  minConfirmations: number;
  paymentWindowMinutes: number;
  termsVersion: string;
  isMock: boolean;
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
  paymentRail: PresalePaymentRail;
  unitPriceZar?: string;
  totalZar?: string;
  unitPriceUsdt: string;
  totalUsdt: string;
  unitPriceUsd: string;
  totalUsd: string;
  usdtPerUsd: string;
  quoteReference: string;
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
  paymentRail: PresalePaymentRail;
  termsAccepted: boolean;
  investorApplication: {
    applicantType: "individual" | "company" | "trust";
    dateOfBirth?: string;
    nationality: string;
    occupation?: string;
    employer?: string;
    countryOfResidence: string;
    physicalAddress: string;
    confirmMobileNumber: string;
    alternativePhone?: string;
    postalAddress?: string;
    taxNumber?: string;
    taxResidenceCountry?: string;
    tin?: string;
    additionalTaxJurisdictions?: string;
    entityRegistrationNumber?: string;
    vatNumber?: string;
    authorisedRepresentativeName?: string;
    authorisedRepresentativePosition?: string;
    beneficialOwnerName?: string;
    beneficialOwnerRelationship?: string;
    sourceOfFunds: "salary" | "business" | "investment" | "property_sale" | "inheritance" | "pension" | "savings" | "company" | "trust" | "other";
    sourceOfFundsDetails: string;
    fundsOwnership: "own" | "company" | "trust" | "other";
    bankAccountHolder: string;
    bankName: string;
    bankBranch?: string;
    bankAccountNumber: string;
    bankAccountType?: string;
    bankSwift?: string;
    amlDeclarationAccepted: boolean;
    suitabilityDeclarationAccepted: boolean;
    informationDeclarationAccepted: boolean;
  };
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
  priceUsd: number;
  usdtPerUsd: number;
  sharePhaseNumber?: number;
  network: string;
  tokenContract?: string;
  receivingAddress: string;
  minConfirmations: number;
  paymentWindowMinutes?: number;
  bonusBuyOneGet?: boolean;
  isMock?: boolean;
  startsAt?: string;
  endsAt?: string;
}

type PresaleCampaignSummary = {
  id: string;
  slug: string;
  name: string;
  issuerName: string;
  shareClass: string;
  status: "draft" | "active" | "paused" | "closed";
  totalShares: number;
  reservedShares: number;
  soldShares: number;
  priceUsdt: number;
  priceUsd: number;
  usdtPerUsd: number;
  sharePhaseNumber: number;
  network: "bsc" | "tron";
  tokenContract?: string;
  receivingAddress?: string;
  minConfirmations: number;
  paymentWindowMinutes: number;
  bonusBuyOneGet: boolean;
  isMock: boolean;
  startsAt?: string;
  endsAt?: string;
};

function campaignSummary(campaign: CampaignRow, includePaymentRoute: boolean): PresaleCampaignSummary {
  return {
    id: campaign.id,
    slug: campaign.slug,
    name: campaign.name,
    issuerName: campaign.issuer_name,
    shareClass: campaign.share_class,
    status: campaign.status as PresaleCampaignSummary["status"],
    totalShares: campaign.total_shares,
    reservedShares: campaign.reserved_shares,
    soldShares: campaign.sold_shares,
    priceUsdt: Number(campaign.price_usdt),
    priceUsd: Number(campaign.price_usd),
    usdtPerUsd: Number(campaign.usdt_per_usd),
    sharePhaseNumber: campaign.share_phase_number,
    network: campaign.network as PresaleCampaignSummary["network"],
    ...(includePaymentRoute ? {
      tokenContract: campaign.token_contract ?? undefined,
      receivingAddress: campaign.receiving_address ?? undefined,
    } : {}),
    minConfirmations: campaign.min_confirmations,
    paymentWindowMinutes: campaign.payment_window_minutes,
    bonusBuyOneGet: campaign.bonus_buy_one_get_one,
    isMock: campaign.is_mock,
    startsAt: campaign.starts_at ?? undefined,
    endsAt: campaign.ends_at ?? undefined,
  };
}

function orderResponse(order: OrderRow, campaign: CampaignRow, txHash?: string | null, confirmations = 0, intent?: PaymentIntentResponse) {
  return {
    orderReference: order.order_reference,
    campaign: campaign.name,
    issuerName: campaign.issuer_name,
    shareClass: campaign.share_class,
    buyerName: order.buyer_name,
    buyerEmail: order.buyer_email,
    quantity: order.quantity,
    paymentRail: order.payment_rail,
    unitPriceZar: order.unit_price_zar ?? undefined,
    totalZar: order.total_zar ?? undefined,
    unitPriceUsdt: order.unit_price_usdt,
    totalUsdt: order.total_usdt,
    unitPriceUsd: order.unit_price_usd,
    totalUsd: order.total_usd,
    usdtPerUsd: order.usdt_per_usd,
    quoteReference: order.quote_reference,
    status: order.status,
    network: intent?.network ?? order.payment_network ?? campaign.network,
    tokenContract: intent?.tokenContract ?? order.payment_token_contract ?? undefined,
    receivingAddress: intent?.receivingAddress ?? order.payment_receiving_address ?? "",
    minConfirmations: intent?.minimumConfirmations ?? order.payment_min_confirmations ?? campaign.min_confirmations,
    paymentDeadline: order.payment_deadline,
    transactionHash: txHash ?? undefined,
    confirmations,
    confirmedAt: order.confirmed_at ?? undefined,
    incorporationStatus: order.incorporation_status,
    createdAt: order.created_at,
  };
}

async function ensurePresalePaymentIntent(order: OrderRow, campaign: CampaignRow): Promise<PaymentIntentResponse> {
  if (!order.external_profile_id) throw APIError.failedPrecondition("Presale order is not bound to an authenticated profile");
  if (paymentRehearsalAllowed(campaign.is_mock)) {
    await ensurePaymentRehearsalWallet(campaign.network, campaign.min_confirmations);
  }
  const obligation = await createPaymentObligation({
    subjectType: "presale_order",
    subjectReference: order.order_reference,
    payerProfileId: order.external_profile_id,
    beneficiaryProfileId: order.external_profile_id,
    settlementCurrency: "USDT",
    settlementAmount: order.total_usdt,
    metadata: { campaignId: order.campaign_id },
  });
  const intent = await createPaymentIntent({
    profileId: order.external_profile_id,
    obligationId: obligation.id,
    network: campaign.network as "tron" | "bsc",
  });
  await presaleDb.rawExec(`UPDATE presale_orders SET payment_obligation_id = $2, payment_intent_id = $3,
    payment_network = $4, payment_receiving_address = $5, payment_token_contract = $6,
    payment_min_confirmations = $7, payment_deadline = $8, updated_at = now()
    WHERE id = $1 AND (payment_intent_id IS NULL OR payment_intent_id = $3)`,
  order.id, obligation.id, intent.id, intent.network, intent.receivingAddress, intent.tokenContract, intent.minimumConfirmations, intent.expiresAt);
  order.payment_obligation_id = obligation.id;
  order.payment_intent_id = intent.id;
  order.payment_network = intent.network;
  order.payment_receiving_address = intent.receivingAddress;
  order.payment_token_contract = intent.tokenContract;
  order.payment_min_confirmations = intent.minimumConfirmations;
  return intent;
}

export async function rejectPresalePayment(orderReference: string, paymentIntentId: string): Promise<void> {
  const tx = await presaleDb.begin();
  try {
    const order = await tx.rawQueryRow<{ id: string; campaign_id: string; invitation_id: string; quantity: number; status: string; payment_intent_id: string | null; bonus_buy_one_get_one: boolean }>(
      `SELECT o.id,o.campaign_id,o.invitation_id,o.quantity,o.status,o.payment_intent_id,c.bonus_buy_one_get_one
         FROM presale_orders o JOIN presale_campaigns c ON c.id = o.campaign_id
        WHERE o.order_reference = $1 FOR UPDATE OF o`, orderReference);
    if (!order) throw APIError.notFound("Presale order not found");
    if (order.payment_intent_id !== paymentIntentId) throw APIError.failedPrecondition("Rejected payment does not belong to this presale order");
    if (order.status === "cancelled") {
      await tx.commit();
      return;
    }
    if (!["awaiting_payment", "payment_submitted", "payment_detected"].includes(order.status)) {
      throw APIError.failedPrecondition(`Presale order cannot be rejected while ${order.status}`);
    }
    const issuedQuantity = issuedSharesForPresale(order.quantity, order.bonus_buy_one_get_one);
    const released = await tx.rawQueryRow<{ id: string }>("UPDATE presale_campaigns SET reserved_shares = reserved_shares - $2, updated_at = now() WHERE id = $1 AND reserved_shares >= $2 RETURNING id", order.campaign_id, issuedQuantity);
    if (!released) throw APIError.failedPrecondition("Presale reservation accounting is inconsistent");
    await tx.rawExec(`UPDATE presale_invitations SET used_shares = used_shares - $2,
      status = CASE WHEN status = 'exhausted' THEN 'active' ELSE status END WHERE id = $1 AND used_shares >= $2`, order.invitation_id, order.quantity);
    await tx.rawExec("UPDATE presale_orders SET status = 'cancelled', updated_at = now() WHERE id = $1", order.id);
    await tx.commit();
  } catch (error) {
    try { await tx.rollback(); } catch { /* transaction may already be closed */ }
    throw error;
  }
}

export async function fulfilSettledPresalePayment(
  orderReference: string,
  paymentIntentId: string,
  transactionHash: string,
  confirmations: number,
): Promise<void> {
  const tx = await presaleDb.begin();
  try {
    const order = await tx.rawQueryRow<{ id: string; campaign_id: string; quantity: number; status: string; payment_intent_id: string | null; bonus_buy_one_get_one: boolean }>(
      `SELECT o.id,o.campaign_id,o.quantity,o.status,o.payment_intent_id,c.bonus_buy_one_get_one
         FROM presale_orders o JOIN presale_campaigns c ON c.id = o.campaign_id
        WHERE o.order_reference = $1 FOR UPDATE OF o`, orderReference);
    if (!order) throw APIError.notFound("Presale order not found");
    if (order.payment_intent_id !== paymentIntentId) throw APIError.failedPrecondition("Settled payment does not belong to this presale order");
    if (["confirmed", "incorporated"].includes(order.status)) {
      await tx.commit();
      if (order.status === "confirmed") await incorporateConfirmedPresaleOrder(orderReference);
      return;
    }
    if (!["awaiting_payment", "payment_submitted", "payment_detected"].includes(order.status)) {
      throw APIError.failedPrecondition(`Presale order cannot be fulfilled while ${order.status}`);
    }
    const issuedQuantity = issuedSharesForPresale(order.quantity, order.bonus_buy_one_get_one);
    const moved = await tx.rawQueryRow<{ id: string }>(`UPDATE presale_campaigns SET reserved_shares = reserved_shares - $2,
      sold_shares = sold_shares + $2, updated_at = now()
      WHERE id = $1 AND reserved_shares >= $2 AND sold_shares + $2 <= total_shares RETURNING id`, order.campaign_id, issuedQuantity);
    if (!moved) throw APIError.failedPrecondition("Presale reservation accounting is inconsistent");
    await tx.rawExec(`UPDATE presale_orders SET status = 'confirmed', confirmed_at = COALESCE(confirmed_at, now()),
      payment_transaction_hash = COALESCE(payment_transaction_hash, $2),
      payment_confirmations = GREATEST(COALESCE(payment_confirmations, 0), $3),
      payment_settled_at = COALESCE(payment_settled_at, now()), updated_at = now() WHERE id = $1`, order.id, transactionHash, confirmations);
    await tx.commit();
    await incorporateConfirmedPresaleOrder(orderReference);
  } catch (error) {
    try { await tx.rollback(); } catch { /* transaction may already be closed */ }
    throw error;
  }
}

async function fulfilWebPayPresalePayment(orderReference: string, providerReference: string, paymentMethod: string): Promise<void> {
  const tx = await presaleDb.begin();
  try {
    const order = await tx.rawQueryRow<{ id: string; campaign_id: string; quantity: number; status: string; payment_rail: PresalePaymentRail; bonus_buy_one_get_one: boolean }>(
      `SELECT o.id,o.campaign_id,o.quantity,o.status,o.payment_rail,c.bonus_buy_one_get_one
         FROM presale_orders o JOIN presale_campaigns c ON c.id = o.campaign_id
        WHERE o.order_reference = $1 FOR UPDATE OF o`, orderReference);
    if (!order) throw APIError.notFound("Presale order not found");
    if (order.payment_rail !== "webpay_card") throw APIError.failedPrecondition("WebPay payment does not belong to this order");
    if (["confirmed", "incorporated"].includes(order.status)) {
      await tx.commit();
      if (order.status === "confirmed") await incorporateConfirmedPresaleOrder(orderReference);
      return;
    }
    if (!["awaiting_payment", "payment_submitted", "payment_detected"].includes(order.status)) {
      throw APIError.failedPrecondition(`Presale order cannot be fulfilled while ${order.status}`);
    }
    const issuedQuantity = issuedSharesForPresale(order.quantity, order.bonus_buy_one_get_one);
    const moved = await tx.rawQueryRow<{ id: string }>(`UPDATE presale_campaigns SET reserved_shares = reserved_shares - $2,
      sold_shares = sold_shares + $2, updated_at = now()
      WHERE id = $1 AND reserved_shares >= $2 AND sold_shares + $2 <= total_shares RETURNING id`, order.campaign_id, issuedQuantity);
    if (!moved) throw APIError.failedPrecondition("Presale reservation accounting is inconsistent");
    await tx.rawExec(`UPDATE presale_orders SET status = 'confirmed', confirmed_at = COALESCE(confirmed_at, now()),
      webpay_system_reference = COALESCE(webpay_system_reference, $2), webpay_payment_method = COALESCE(webpay_payment_method, $3),
      payment_settled_at = COALESCE(payment_settled_at, now()), updated_at = now() WHERE id = $1`,
    order.id, providerReference, paymentMethod);
    await tx.commit();
    await incorporateConfirmedPresaleOrder(orderReference);
  } catch (error) {
    try { await tx.rollback(); } catch { /* transaction may already be closed */ }
    throw error;
  }
}

/**
 * Issues one independently settled presale order into the authoritative share
 * ledger. Unique presale order references make provider retries safe across the
 * separate database commits.
 * Author: Klaasvaakie ( |╲ )
 */
export async function incorporateConfirmedPresaleOrder(orderReference: string): Promise<{ incorporated: boolean; purchaseId: string }> {
  const order = await presaleDb.rawQueryRow<{
    id: string; order_reference: string; external_profile_id: string | null; quantity: number; total_usd: string;
    status: string; incorporation_status: string; bonus_buy_one_get_one: boolean; share_phase_number: number;
    target_purchase_id: string | null;
  }>(`SELECT o.id,o.order_reference,o.external_profile_id,o.quantity,o.total_usd::text AS total_usd,
             o.status,o.incorporation_status,o.target_purchase_id,c.bonus_buy_one_get_one,c.share_phase_number
        FROM presale_orders o JOIN presale_campaigns c ON c.id=o.campaign_id
       WHERE o.order_reference=$1`, orderReference);
  if (!order) throw APIError.notFound("Presale order not found");
  if (order.status === "incorporated" && order.incorporation_status === "incorporated" && order.target_purchase_id) {
    return { incorporated: false, purchaseId: order.target_purchase_id };
  }
  if (order.status !== "confirmed" || order.incorporation_status !== "pending") {
    throw APIError.failedPrecondition(`Presale order cannot be incorporated while ${order.status}/${order.incorporation_status}`);
  }
  if (!order.external_profile_id) throw APIError.failedPrecondition(`Order ${order.order_reference} has no authenticated member profile`);

  const issuedQuantity = issuedSharesForPresale(order.quantity, order.bonus_buy_one_get_one);
  const shareTx = await sharesDb.begin();
  let purchaseId: string;
  let incorporated = false;
  try {
    await shareTx.rawExec("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", order.order_reference);
    const existing = await shareTx.rawQueryRow<{ id: string }>(
      "SELECT id FROM share_purchases WHERE presale_order_reference=$1 FOR UPDATE", order.order_reference);
    if (existing) {
      const certificate = await shareTx.rawQueryRow<{ id: string }>(
        "SELECT id FROM share_certificates WHERE presale_order_reference=$1", order.order_reference);
      if (!certificate) throw APIError.failedPrecondition(`Order ${order.order_reference} has a purchase without a certificate`);
      purchaseId = existing.id;
    } else {
      const phase = await shareTx.rawQueryRow<{ id: string }>(`UPDATE share_phases SET quantity_available=quantity_available-$2
        WHERE phase_number=$1 AND status IN ('active','paused') AND quantity_available >= $2 RETURNING id`,
      order.share_phase_number, issuedQuantity);
      if (!phase) throw APIError.failedPrecondition(`Share phase ${order.share_phase_number} cannot fulfil ${issuedQuantity} shares`);
      purchaseId = crypto.randomUUID();
      const certificateId = crypto.randomUUID();
      await shareTx.rawExec(`INSERT INTO share_certificates
        (id,profile_id,certificate_number,total_shares,status,issued_at,presale_order_reference,source)
        VALUES ($1,$2,$3,$4,'issued',now(),$5,'presale')`, certificateId, order.external_profile_id,
      `CERT-PRESALE-${order.order_reference}`, issuedQuantity, order.order_reference);
      await shareTx.rawExec(`INSERT INTO share_purchases
        (id,profile_id,phase_id,quantity,bonus_quantity,total_amount,status,certificate_id,presale_order_reference,source)
        VALUES ($1,$2,$3,$4,$5,$6::numeric,'paid',$7,$8,'presale')`, purchaseId, order.external_profile_id, phase.id,
      order.quantity, issuedQuantity - order.quantity, order.total_usd, certificateId, order.order_reference);
      incorporated = true;
    }
    await shareTx.commit();
  } catch (error) {
    await shareTx.rollback();
    throw error;
  }
  await presaleDb.rawExec(`UPDATE presale_orders SET incorporation_status='incorporated',target_purchase_id=$2,
    status='incorporated',updated_at=now() WHERE id=$1 AND incorporation_status='pending'`, order.id, purchaseId);
  return { incorporated, purchaseId };
}

interface WebPayNotificationRequest {
  payeeSiteId: string;
  payeeUuid: string;
  payeeAccountUuid: string;
  payeeRefInfo: string;
  payeeOrderNr: string;
  requestTokenId: string;
  requestAmount: string | number;
  requestCurrency: "ZAR";
  requestStatus: "COMPLETED" | "EXPIRED" | "PENDING" | "CANCELLED";
  paymentSystemReference?: string;
  paymentAmount?: string | number;
  paymentCurrency?: string;
  paymentMethod?: string;
  checksum: string;
}

interface WebPayProcessNotificationRequest {
  payeeAccountUuid: string;
  processUuid: string;
  processStage: string;
  processStatus: "payment_in_progress" | "COMPLETED" | "EXPIRED" | "FAILED" | "PENDING" | "REJECTED" | "REVERSED";
  processOrderNo: string;
  checksum: string;
}

type ApplicationDraftResponse = {
  applicationId: string;
  applicationNumber: string;
  status: "draft";
  applicantType: "individual" | "company" | "trust";
  rowVersion: number;
  phaseCompleted: number;
  schemaVersion: string;
};

interface CreatePresaleApplicationRequest {
  inviteToken: string;
  applicantType: "individual" | "company" | "trust";
}

interface SavePresaleApplicationPhaseRequest {
  applicationId: string;
  phase: number;
  rowVersion: number;
  payload: PhaseOneApplicant;
}

function decryptPresaleSecret(ciphertext: DatabaseBinary, nonce: DatabaseBinary, authTag: DatabaseBinary): string {
  const key = createNodeHash("sha256").update(InvestorApplicationEncryptionKey()).digest();
  const decipher = createDecipheriv("aes-256-gcm", key, databaseBinaryToBuffer(nonce));
  decipher.setAuthTag(databaseBinaryToBuffer(authTag));
  const decoded = JSON.parse(Buffer.concat([
    decipher.update(databaseBinaryToBuffer(ciphertext)),
    decipher.final(),
  ]).toString("utf8")) as unknown;
  if (typeof decoded !== "string") throw new Error("invalid_presale_resume_secret");
  return decoded;
}

function normalizePresaleApplicationDraft(decoded: unknown): Record<string, string | boolean> {
  if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) throw new Error("invalid_presale_application_draft");
  const source = decoded as Record<string, unknown>;
  const draft = Object.fromEntries(Object.entries(source).filter((entry): entry is [string, string | boolean] =>
    typeof entry[1] === "string" || typeof entry[1] === "boolean"));

  // Versions created by the original application API used the structured PhaseOneApplicant contract.
  // Translate those fields into the current form names instead of silently dropping nested legacy data.
  const address = source.physicalAddress && typeof source.physicalAddress === "object" && !Array.isArray(source.physicalAddress)
    ? source.physicalAddress as Record<string, unknown> : null;
  const entity = source.entity && typeof source.entity === "object" && !Array.isArray(source.entity)
    ? source.entity as Record<string, unknown> : null;
  const representative = entity?.authorisedRepresentative && typeof entity.authorisedRepresentative === "object"
    && !Array.isArray(entity.authorisedRepresentative)
    ? entity.authorisedRepresentative as Record<string, unknown> : null;
  const assign = (name: string, value: unknown) => {
    if (typeof value === "string" && value.trim() && !(name in draft)) draft[name] = value;
  };
  assign("buyerName", [source.legalName, source.surname].filter((value) => typeof value === "string" && value.trim()).join(" "));
  assign("buyerEmail", source.emailAddress);
  assign("buyerPhone", source.mobileNumber);
  assign("confirmMobileNumber", source.mobileNumber);
  assign("countryOfResidence", address?.country);
  assign("physicalAddress", address ? [address.line1, address.line2, address.city, address.region, address.postalCode, address.country]
    .filter((value) => typeof value === "string" && value.trim()).join(", ") : undefined);
  assign("entityRegistrationNumber", entity?.registrationNumber);
  assign("vatNumber", entity?.vatNumber);
  assign("authorisedRepresentativeName", representative?.name);
  assign("authorisedRepresentativePosition", representative?.position);
  return draft;
}

function decryptPresaleApplicationDraft(ciphertext: DatabaseBinary, nonce: DatabaseBinary, authTag: DatabaseBinary): Record<string, string | boolean> {
  const key = createNodeHash("sha256").update(InvestorApplicationEncryptionKey()).digest();
  const decipher = createDecipheriv("aes-256-gcm", key, databaseBinaryToBuffer(nonce));
  decipher.setAuthTag(databaseBinaryToBuffer(authTag));
  const decoded = JSON.parse(Buffer.concat([
    decipher.update(databaseBinaryToBuffer(ciphertext)),
    decipher.final(),
  ]).toString("utf8")) as unknown;
  return normalizePresaleApplicationDraft(decoded);
}

interface RegisterPresaleMemberRequest {
  inviteToken: string;
  email: string;
  password: string;
  legalName: string;
  phone: string;
  applicantType: "individual" | "company" | "trust";
  nationality: string;
  countryOfResidence: string;
  physicalAddress: string;
}

interface PresalePortalResponse {
  applicant: { profileId: string; profileNumber: string; email: string; legalName: string; phone: string; country: string; physicalAddress: string };
  application: null | {
    applicationId: string; applicationNumber: string; campaignName: string; status: string;
    applicantType: "individual" | "company" | "trust"; phaseCompleted: number; completionPercent: number; nextStep: number; resumeUrl: string | null;
    draft: Record<string, string | boolean> | null;
  };
  kyc: { status: string; verified: boolean };
  order: null | { orderReference: string; status: string; incorporationStatus: string; paymentRail: PresalePaymentRail; webPayProcessStatus?: string; webPayProcessStage?: string };
  shareholder: {
    totalIssuedShares: number;
    holdings: Array<{
      orderReference: string; campaignName: string; paidShares: number; bonusShares: number; allocatedShares: number;
      status: "awaiting_issuance" | "issued" | "revoked" | "issuance_error"; incorporationStatus: string;
      certificate?: { certificateNumber: string; totalShares: number; status: string; issuedAt: string; revokedAt?: string };
    }>;
  };
  continuation: { nextStep: number | null; reason: ApplicantContinuationReason; resumeUrl: string | null };
}

export const registerPresaleMember = api<
  RegisterPresaleMemberRequest,
  { token: string; profileId: string; profileNumber: string; applicationId: string; created: boolean; emailStatus: "sent" | "failed" | "existing" }
>(
  { method: "POST", path: "/presale/members", expose: true },
  async (request) => {
    const payload = registerPresaleMemberInput.parse(request);
    const email = normalizeEmail(payload.email);
    const invitation = await presaleDb.rawQueryRow<{ id: string; campaign_id: string; email: string | null; campaign_name: string }>(
      `SELECT i.id, i.campaign_id, i.email, c.name AS campaign_name
       FROM presale_invitations i JOIN presale_campaigns c ON c.id = i.campaign_id
       WHERE i.token_hash = $1 AND i.status = 'active' AND (i.expires_at IS NULL OR i.expires_at > now())
         AND c.status = 'active' AND (c.starts_at IS NULL OR c.starts_at <= now()) AND (c.ends_at IS NULL OR c.ends_at > now())`,
      hashSecret(payload.inviteToken),
    );
    if (!invitation) throw APIError.permissionDenied("A valid private invitation is required");
    if (invitation.email && normalizeEmail(invitation.email) !== email) {
      throw APIError.permissionDenied("This invitation belongs to a different email address");
    }

    const existing = await identityDb.rawQueryRow<{
      user_id: string; password_hash: string | null; profile_id: string; profile_number: string; is_presale_investor: boolean;
    }>(
      `SELECT u.id AS user_id, u.password_hash, p.id AS profile_id, p.unique_profile_number AS profile_number,
              EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
                      WHERE ur.user_id = u.id AND r.name = 'presale_investor') AS is_presale_investor
       FROM users u JOIN profiles p ON p.user_id = u.id
       WHERE u.email = $1 ORDER BY p.created_at DESC LIMIT 1`,
      email,
    );
    let userId: string;
    let profileId: string;
    let profileNumber: string;
    let created = false;

    if (existing) {
      if (!existing.is_presale_investor) {
        throw APIError.failedPrecondition("Use a different email address for the separate KaSiShares applicant account");
      }
      if (!existing.password_hash || !verifyPassword(payload.password, existing.password_hash)) {
        throw APIError.unauthenticated("The email or password is incorrect");
      }
      userId = existing.user_id;
      profileId = existing.profile_id;
      profileNumber = existing.profile_number;
    } else {
      userId = crypto.randomUUID();
      profileId = crypto.randomUUID();
      profileNumber = `KSI-${crypto.randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase()}`;
      const tx = await identityDb.begin();
      try {
        await tx.rawExec(
          "INSERT INTO users (id, email, phone, password_hash) VALUES ($1, $2, $3, $4)",
          userId, email, payload.phone, hashPassword(payload.password),
        );
        await tx.rawExec(
          `INSERT INTO profiles
             (id, user_id, profile_type, unique_profile_number, first_name, company_name, country, status,
              membership_type, citizenship_type, address_line, onboarding_authority)
           VALUES ($1,$2,$3,$4,$5,$6,$7,'pending',$8,$9,$10,'kasihub')`,
          profileId,
          userId,
          payload.applicantType === "individual" ? "individual" : "company",
          profileNumber,
          payload.applicantType === "individual" ? payload.legalName : null,
          payload.applicantType === "individual" ? null : payload.legalName,
          payload.countryOfResidence,
          `PRESALE_${payload.applicantType.toUpperCase()}`,
          payload.applicantType === "trust" ? "PRESALE_TRUST" : "PRESALE_INVESTOR",
          payload.physicalAddress,
        );
        await tx.rawExec(
          `INSERT INTO user_roles (user_id, role_id)
           SELECT $1, id FROM roles WHERE name = 'presale_investor'
           ON CONFLICT (user_id, role_id) DO NOTHING`,
          userId,
        );
        await tx.commit();
        created = true;
      } catch (error) {
        await tx.rollback();
        throw error;
      }
    }

    const token = crypto.randomUUID();
    await identityDb.rawExec(
      `INSERT INTO sessions (user_id, token, session_scope, created_at, expires_at)
       VALUES ($1, $2, 'presale', now(), now() + interval '7 days')`,
      userId, hashSessionToken(token),
    );
    const applicationId = crypto.randomUUID();
    const applicationNumber = `KSA-${crypto.randomUUID().slice(0, 8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
    await presaleDb.rawExec(
      `INSERT INTO presale_applications
         (id, application_number, external_profile_id, campaign_id, invitation_id, applicant_type, phase_completed, completion_percent)
       VALUES ($1,$2,$3,$4,$5,$6,1,20) ON CONFLICT DO NOTHING`,
      applicationId, applicationNumber, profileId, invitation.campaign_id, invitation.id, payload.applicantType,
    );
    const application = await presaleDb.rawQueryRow<{ id: string }>(
      `SELECT id FROM presale_applications WHERE external_profile_id = $1 AND campaign_id = $2
       AND status NOT IN ('withdrawn','expired','superseded','compliance_rejected','exco_rejected')
       ORDER BY created_at DESC LIMIT 1`,
      profileId, invitation.campaign_id,
    );
    if (!application) throw APIError.internal("The KaSiShares application could not be created");
    const resumeToken = encryptInvestorApplication(payload.inviteToken);
    await presaleDb.rawExec(
      `UPDATE presale_applications
          SET resume_token_ciphertext = COALESCE(resume_token_ciphertext, $2),
              resume_token_nonce = COALESCE(resume_token_nonce, $3),
              resume_token_auth_tag = COALESCE(resume_token_auth_tag, $4),
              resume_token_key_version = COALESCE(resume_token_key_version, 'v1'),
              phase_completed = GREATEST(phase_completed, 1),
              completion_percent = GREATEST(completion_percent, 20),
              updated_at = now()
        WHERE id = $1`,
      application.id, resumeToken.ciphertext, resumeToken.nonce, resumeToken.authTag,
    );

    let emailStatus: "sent" | "failed" | "existing" = "existing";
    const deliveryId = crypto.randomUUID();
    const delivery = await presaleDb.rawQueryRow<{ id: string; status: string }>(
      `INSERT INTO presale_email_deliveries
         (id, external_profile_id, application_id, email_type, recipient_email, status)
       VALUES ($1,$2,$3,'account_created',$4,'pending')
       ON CONFLICT (external_profile_id, email_type) DO UPDATE
         SET application_id = EXCLUDED.application_id
       RETURNING id, status`,
      deliveryId, profileId, application.id, email,
    );
    if (delivery?.status === "sent") emailStatus = "existing";
    else if (delivery) emailStatus = await sendPresaleAccountCreatedEmail({
      deliveryId: delivery.id, applicationId: application.id, profileId, recipient: email, legalName: payload.legalName,
    });
    return { token, profileId, profileNumber, applicationId: application.id, created, emailStatus };
  },
);

export const loginPresaleApplicant = api<
  { email: string; password: string },
  { token: string; profileId: string; profileNumber: string }
>({ method: "POST", path: "/presale/auth/login", expose: true }, async (request) => {
  const payload = z.object({ email: z.string().email().max(254), password: z.string().min(12).max(128) }).parse(request);
  const user = await identityDb.rawQueryRow<{ id: string; password_hash: string | null; profile_id: string; profile_number: string }>(
    `SELECT u.id, u.password_hash, p.id AS profile_id, p.unique_profile_number AS profile_number
     FROM users u JOIN profiles p ON p.user_id = u.id
     WHERE u.email = $1 AND EXISTS (
       SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
       WHERE ur.user_id = u.id AND r.name = 'presale_investor'
     ) ORDER BY p.created_at DESC LIMIT 1`,
    normalizeEmail(payload.email),
  );
  if (!user?.password_hash || !verifyPassword(payload.password, user.password_hash)) {
    throw APIError.unauthenticated("Invalid email or password");
  }
  const token = crypto.randomUUID();
  await identityDb.rawExec(
    `INSERT INTO sessions (user_id, token, session_scope, created_at, expires_at)
     VALUES ($1,$2,'presale',now(),now() + interval '7 days')`,
    user.id, hashSessionToken(token),
  );
  return { token, profileId: user.profile_id, profileNumber: user.profile_number };
});

const webPayNotificationInput = z.object({
  payeeSiteId: z.string().trim().min(1).max(20),
  payeeUuid: z.string().uuid(),
  payeeAccountUuid: z.string().uuid(),
  payeeRefInfo: z.string().trim().min(1).max(36),
  payeeOrderNr: z.string().trim().length(20),
  requestTokenId: z.string().trim().min(1).max(20),
  requestAmount: z.union([z.string(), z.number()]).transform(String),
  requestCurrency: z.literal("ZAR"),
  requestStatus: z.enum(["COMPLETED", "EXPIRED", "PENDING", "CANCELLED"]),
  paymentSystemReference: z.string().trim().max(100).optional(),
  paymentAmount: z.union([z.string(), z.number()]).transform(String).optional(),
  paymentCurrency: z.string().trim().max(3).optional(),
  paymentMethod: z.string().trim().max(40).optional(),
  checksum: z.string().trim().length(32),
}).passthrough();

const webPayProcessNotificationInput = z.object({
  payeeAccountUuid: z.string().uuid(),
  processUuid: z.string().uuid(),
  processStage: z.string().trim().min(1).max(36),
  processStatus: z.enum(["payment_in_progress", "COMPLETED", "EXPIRED", "FAILED", "PENDING", "REJECTED", "REVERSED"]),
  processOrderNo: z.string().trim().length(20),
  checksum: z.string().trim().length(32),
}).passthrough();

export const logoutPresaleApplicant = api<void, { ok: true }>(
  { method: "POST", path: "/presale/auth/logout", expose: true },
  async () => {
    const session = await requirePresaleSession();
    await identityDb.rawExec("UPDATE sessions SET revoked_at = now() WHERE token = $1", session.token);
    return { ok: true };
  },
);

export const presaleApplicantPortal = api<void, PresalePortalResponse>(
  { method: "GET", path: "/presale/applicant/portal", expose: true },
  async () => {
    const session = await requirePresaleSession();
    const profile = await identityDb.rawQueryRow<{
      first_name: string | null; company_name: string | null; phone: string | null; country: string | null; address_line: string | null;
    }>(
      `SELECT p.first_name, p.company_name, u.phone, p.country, p.address_line
       FROM profiles p JOIN users u ON u.id = p.user_id WHERE p.id = $1`,
      session.profile.id,
    );
    const application = await presaleDb.rawQueryRow<{
      id: string; application_number: string; campaign_name: string; status: string;
      applicant_type: "individual" | "company" | "trust";
      phase_completed: number; completion_percent: number; resume_token_ciphertext: DatabaseBinary | null;
      resume_token_nonce: DatabaseBinary | null; resume_token_auth_tag: DatabaseBinary | null; resume_access_available: boolean;
      payload_ciphertext: DatabaseBinary | null; payload_nonce: DatabaseBinary | null; payload_auth_tag: DatabaseBinary | null;
    }>(
      `SELECT a.id, a.application_number, c.name AS campaign_name, a.status, a.applicant_type, a.phase_completed, a.completion_percent,
              a.resume_token_ciphertext, a.resume_token_nonce, a.resume_token_auth_tag,
              v.payload_ciphertext, v.payload_nonce, v.payload_auth_tag,
              COALESCE((i.status = 'active' AND (i.expires_at IS NULL OR i.expires_at > now())
               AND c.status = 'active' AND (c.starts_at IS NULL OR c.starts_at <= now())
               AND (c.ends_at IS NULL OR c.ends_at > now())), false) AS resume_access_available
       FROM presale_applications a JOIN presale_campaigns c ON c.id = a.campaign_id
       LEFT JOIN presale_application_versions v ON v.application_id = a.id AND v.version = a.current_version
       LEFT JOIN presale_invitations i ON i.id = a.invitation_id
       WHERE a.external_profile_id = $1 ORDER BY a.created_at DESC LIMIT 1`,
      session.profile.id,
    );
    const kyc = await kycDb.rawQueryRow<{ status: string }>(
      `SELECT status FROM kyc_cases WHERE profile_id = $1 AND provider = 'kasihub_international'
       ORDER BY submitted_at DESC NULLS LAST LIMIT 1`, session.profile.id,
    );
    const order = await presaleDb.rawQueryRow<{
      order_reference: string; status: string; incorporation_status: string;
      buyer_name: string; buyer_email: string; buyer_phone: string | null; quantity: number; payment_rail: PresalePaymentRail;
      webpay_process_status: string | null; webpay_process_stage: string | null;
      investor_application_ciphertext: DatabaseBinary | null; investor_application_nonce: DatabaseBinary | null;
      investor_application_auth_tag: DatabaseBinary | null;
    }>(
      `SELECT order_reference, status, incorporation_status, buyer_name, buyer_email, buyer_phone, quantity, payment_rail,
              webpay_process_status, webpay_process_stage,
              investor_application_ciphertext, investor_application_nonce, investor_application_auth_tag
       FROM presale_orders
       WHERE external_profile_id = $1 ORDER BY created_at DESC LIMIT 1`,
      session.profile.id,
    );
    const paidOrders = await presaleDb.rawQueryAll<PresalePaidOrder>(
      `SELECT o.order_reference, c.name AS campaign_name, o.quantity, c.bonus_buy_one_get_one,
              o.status, o.incorporation_status
       FROM presale_orders o JOIN presale_campaigns c ON c.id = o.campaign_id
       WHERE o.external_profile_id = $1 AND o.status IN ('confirmed', 'incorporated')
       ORDER BY o.confirmed_at DESC NULLS LAST, o.created_at DESC`,
      session.profile.id,
    );
    const certificates = await sharesDb.rawQueryAll<PresaleCertificate>(
      `SELECT certificate_number, total_shares, status, issued_at, revoked_at, presale_order_reference
       FROM share_certificates
       WHERE profile_id = $1 AND source = 'presale' AND presale_order_reference IS NOT NULL
       ORDER BY issued_at DESC`,
      session.profile.id,
    );
    const shareholder = buildShareholderPortfolio(paidOrders, certificates);
    const continuation = deriveApplicantContinuation({
      application: application ? {
        status: application.status,
        phaseCompleted: application.phase_completed,
        hasResumeCredential: Boolean(application.resume_token_ciphertext && application.resume_token_nonce && application.resume_token_auth_tag),
        resumeAccessAvailable: application.resume_access_available,
      } : null,
      kycStatus: kyc?.status ?? null,
      orderStatus: order?.status ?? null,
    });
    const resumeUrl = continuation.reason === "resume" && application?.resume_token_ciphertext
      && application.resume_token_nonce && application.resume_token_auth_tag
      ? `/presale?invite=${encodeURIComponent(decryptPresaleSecret(application.resume_token_ciphertext, application.resume_token_nonce, application.resume_token_auth_tag))}`
      : null;
    const orderDraft = order?.investor_application_ciphertext && order.investor_application_nonce && order.investor_application_auth_tag
      ? decryptPresaleApplicationDraft(order.investor_application_ciphertext, order.investor_application_nonce, order.investor_application_auth_tag)
      : {};
    const applicationDraft = application?.payload_ciphertext && application.payload_nonce && application.payload_auth_tag
      ? decryptPresaleApplicationDraft(application.payload_ciphertext, application.payload_nonce, application.payload_auth_tag)
      : {};
    const restoredDraft = { ...orderDraft, ...applicationDraft };
    if (order) {
      restoredDraft.buyerName ||= order.buyer_name;
      restoredDraft.buyerEmail ||= order.buyer_email;
      if (order.buyer_phone) {
        restoredDraft.buyerPhone ||= order.buyer_phone;
        restoredDraft.confirmMobileNumber ||= order.buyer_phone;
      }
      restoredDraft.quantity ||= String(order.quantity);
      if (order.payment_rail === "webpay_card" || order.payment_rail === "remitano_usdt") restoredDraft.paymentRail ||= order.payment_rail;
    }
    if (profile?.first_name || profile?.company_name) restoredDraft.buyerName ??= profile.first_name ?? profile.company_name ?? "";
    restoredDraft.buyerEmail ??= session.user.email;
    if (profile?.phone) {
      restoredDraft.buyerPhone ??= profile.phone;
      restoredDraft.confirmMobileNumber ??= profile.phone;
    }
    if (profile?.country) restoredDraft.countryOfResidence ??= profile.country;
    if (profile?.address_line) restoredDraft.physicalAddress ??= profile.address_line;
    return {
      applicant: { profileId: session.profile.id, profileNumber: session.profile.unique_profile_number, email: session.user.email,
        legalName: profile?.first_name ?? profile?.company_name ?? "", phone: profile?.phone ?? "",
        country: profile?.country ?? "", physicalAddress: profile?.address_line ?? "" },
      application: application ? {
        applicationId: application.id, applicationNumber: application.application_number,
        campaignName: application.campaign_name, status: application.status, applicantType: application.applicant_type,
        phaseCompleted: application.phase_completed, completionPercent: application.completion_percent,
        nextStep: continuation.nextStep ?? Math.min(5, application.phase_completed + 1),
        resumeUrl,
        draft: restoredDraft,
      } : null,
      kyc: { status: kyc?.status ?? "pending", verified: kyc?.status === "approved" },
      order: order ? { orderReference: order.order_reference, status: order.status, incorporationStatus: order.incorporation_status,
        paymentRail: order.payment_rail, webPayProcessStatus: order.webpay_process_status ?? undefined,
        webPayProcessStage: order.webpay_process_stage ?? undefined } : null,
      shareholder,
      continuation: { ...continuation, resumeUrl },
    };
  },
);

export const updatePresaleApplicantProgress = api<
  { phaseCompleted: number; draft?: Record<string, string | boolean> }, { phaseCompleted: number; completionPercent: number }
>({ method: "POST", path: "/presale/applicant/progress", expose: true }, async (request) => {
  const session = await requirePresaleSession();
  const payload = z.object({
    phaseCompleted: z.number().int().min(1).max(4),
    draft: z.record(z.string().min(1).max(80), z.union([z.string().max(2000), z.boolean()])).default({}),
  }).parse(request);
  for (const forbidden of ["accountPassword", "confirmAccountPassword"]) delete payload.draft[forbidden];
  const encrypted = encryptInvestorApplication(payload.draft);
  const payloadHash = createNodeHash("sha256").update(JSON.stringify(payload.draft)).digest("hex");
  const tx = await presaleDb.begin();
  try {
    const application = await tx.rawQueryRow<{ id: string; current_version: number }>(
      `SELECT id,current_version FROM presale_applications
       WHERE external_profile_id = $1 ORDER BY created_at DESC LIMIT 1 FOR UPDATE`, session.profile.id,
    );
    if (!application) throw APIError.notFound("Investor application not found");
    const nextVersion = application.current_version + 1;
    await tx.rawExec("UPDATE presale_application_versions SET status = 'superseded' WHERE application_id = $1 AND status = 'draft'", application.id);
    await tx.rawExec(
      `INSERT INTO presale_application_versions
         (id,application_id,version,schema_version,status,public_summary,payload_ciphertext,payload_nonce,payload_auth_tag,
          encryption_key_version,payload_sha256,created_by_profile_id,created_by_user_id)
       VALUES ($1,$2,$3,$4,'draft',$5::jsonb,$6,$7,$8,'v1',$9,$10,$11)`,
      crypto.randomUUID(), application.id, nextVersion, INVESTOR_APPLICATION_SCHEMA_VERSION,
      JSON.stringify({ phaseCompleted: payload.phaseCompleted }), encrypted.ciphertext, encrypted.nonce, encrypted.authTag,
      payloadHash, session.profile.id, session.user.id,
    );
    const updated = await tx.rawQueryRow<{ phase_completed: number; completion_percent: number }>(
      `UPDATE presale_applications SET current_version = $2, phase_completed = GREATEST(phase_completed, $3),
         completion_percent = GREATEST(completion_percent, $3 * 20), row_version = row_version + 1, updated_at = now()
       WHERE id = $1 RETURNING phase_completed, completion_percent`, application.id, nextVersion, payload.phaseCompleted,
    );
    await tx.commit();
    if (!updated) throw APIError.notFound("Investor application not found");
    return { phaseCompleted: updated.phase_completed, completionPercent: updated.completion_percent };
  } catch (error) {
    try { await tx.rollback(); } catch { /* transaction may already be closed */ }
    throw error;
  }
});

export const createPresaleApplication = api<CreatePresaleApplicationRequest, { application: ApplicationDraftResponse }>(
  { method: "POST", path: "/presale/applications", expose: true },
  async (request) => {
    const payload = createApplicationInput.parse(request);
    const session = await requirePresaleSession();
    const invitation = await presaleDb.rawQueryRow<{ id: string; campaign_id: string; email: string | null }>(
      `SELECT i.id, i.campaign_id, i.email
       FROM presale_invitations i JOIN presale_campaigns c ON c.id = i.campaign_id
       WHERE i.token_hash = $1 AND i.status = 'active' AND (i.expires_at IS NULL OR i.expires_at > now())
         AND c.status IN ('draft', 'active', 'paused')`,
      hashSecret(payload.inviteToken),
    );
    if (!invitation) throw APIError.permissionDenied("A valid private invitation is required");
    if (invitation.email && normalizeEmail(invitation.email) !== normalizeEmail(session.user.email)) {
      throw APIError.permissionDenied("This invitation belongs to another account");
    }

    const applicationId = crypto.randomUUID();
    const applicationNumber = `KSA-${crypto.randomUUID().slice(0, 8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
    await presaleDb.rawExec(
      `INSERT INTO presale_applications
         (id, application_number, external_profile_id, campaign_id, invitation_id, applicant_type)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT DO NOTHING`,
      applicationId, applicationNumber, session.profile.id, invitation.campaign_id, invitation.id, payload.applicantType,
    );
    const row = await presaleDb.rawQueryRow<{
      id: string; application_number: string; status: "draft"; applicant_type: "individual" | "company" | "trust";
      row_version: number; phase_completed: number;
    }>(
      `SELECT id, application_number, status, applicant_type, row_version, phase_completed
       FROM presale_applications
       WHERE external_profile_id = $1 AND campaign_id = $2
         AND status NOT IN ('withdrawn','expired','superseded','compliance_rejected','exco_rejected')
       ORDER BY created_at DESC LIMIT 1`,
      session.profile.id, invitation.campaign_id,
    );
    if (!row || row.status !== "draft") throw APIError.failedPrecondition("The current application cannot be edited as a draft");
    if (row.applicant_type !== payload.applicantType) {
      throw APIError.failedPrecondition("The existing application draft has a different applicant type");
    }
    return { application: { applicationId: row.id, applicationNumber: row.application_number, status: "draft",
      applicantType: row.applicant_type, rowVersion: Number(row.row_version), phaseCompleted: row.phase_completed,
      schemaVersion: INVESTOR_APPLICATION_SCHEMA_VERSION } };
  },
);

export const savePresaleApplicationPhase = api<SavePresaleApplicationPhaseRequest, { application: ApplicationDraftResponse }>(
  { method: "PATCH", path: "/presale/applications/:applicationId/phases/:phase", expose: true },
  async (request) => {
    const payload = saveApplicationPhaseInput.parse(request);
    const session = await requirePresaleSession();
    const encrypted = encryptInvestorApplication(payload.payload);
    const payloadHash = createNodeHash("sha256").update(JSON.stringify(payload.payload)).digest("hex");
    const versionId = crypto.randomUUID();
    const tx = await presaleDb.begin();
    try {
      const application = await tx.rawQueryRow<{
        id: string; application_number: string; status: string; applicant_type: "individual" | "company" | "trust";
        current_version: number; row_version: number;
      }>(
        `SELECT id, application_number, status, applicant_type, current_version, row_version
         FROM presale_applications WHERE id = $1 AND external_profile_id = $2 FOR UPDATE`,
        payload.applicationId, session.profile.id,
      );
      if (!application) throw APIError.notFound("Investor application not found");
      if (application.status !== "draft") throw APIError.failedPrecondition("Submitted applications cannot be edited");
      if (Number(application.row_version) !== payload.rowVersion) throw APIError.aborted("The application changed; reload before saving");
      if (application.applicant_type !== payload.payload.applicantType) {
        throw APIError.invalidArgument("Applicant type must match the application draft");
      }
      const nextVersion = application.current_version + 1;
      await tx.rawExec(
        `UPDATE presale_application_versions SET status = 'superseded'
         WHERE application_id = $1 AND status = 'draft'`, application.id,
      );
      await tx.rawExec(
        `INSERT INTO presale_application_versions
           (id, application_id, version, schema_version, status, public_summary,
            payload_ciphertext, payload_nonce, payload_auth_tag, encryption_key_version, payload_sha256,
            created_by_profile_id, created_by_user_id)
         VALUES ($1,$2,$3,$4,'draft',$5::jsonb,$6,$7,$8,'v1',$9,$10,$11)`,
        versionId, application.id, nextVersion, INVESTOR_APPLICATION_SCHEMA_VERSION,
        JSON.stringify({ applicantType: payload.payload.applicantType, phaseOneComplete: true }),
        encrypted.ciphertext, encrypted.nonce, encrypted.authTag, payloadHash, session.profile.id, session.user.id,
      );
      const updated = await tx.rawQueryRow<{ row_version: number }>(
        `UPDATE presale_applications SET current_version = $2, phase_completed = GREATEST(phase_completed, 1),
           completion_percent = GREATEST(completion_percent, 16), row_version = row_version + 1, updated_at = now()
         WHERE id = $1 RETURNING row_version`, application.id, nextVersion,
      );
      await tx.rawExec(
        `INSERT INTO presale_application_events
           (id, application_id, application_version_id, event_type, actor_type, actor_id, safe_metadata)
         VALUES ($1,$2,$3,'phase_saved','applicant',$4,$5::jsonb)`,
        crypto.randomUUID(), application.id, versionId, session.profile.id, JSON.stringify({ phase: 1, schemaVersion: INVESTOR_APPLICATION_SCHEMA_VERSION }),
      );
      await tx.commit();
      return { application: { applicationId: application.id, applicationNumber: application.application_number, status: "draft",
        applicantType: application.applicant_type, rowVersion: Number(updated?.row_version ?? payload.rowVersion + 1), phaseCompleted: 1,
        schemaVersion: INVESTOR_APPLICATION_SCHEMA_VERSION } };
    } catch (error) {
      try { await tx.rollback(); } catch { /* transaction may already be closed */ }
      throw error;
    }
  },
);

export const getPresaleOffer = api<
  { inviteToken: string },
  { offer: PresaleOfferResponse }
>({ method: "GET", path: "/presale/offer", expose: true }, async (req) => {
  if (!req.inviteToken || req.inviteToken.length < 32) throw APIError.permissionDenied("A valid private invitation is required");
  const row = await presaleDb.rawQueryRow<CampaignRow & { max_shares: number; used_shares: number; invitation_email: string | null; webpay_unit_price_zar: string }>(
    `SELECT c.*, i.max_shares, i.used_shares, i.email AS invitation_email,
            COALESCE(i.webpay_unit_price_zar_override, $2::numeric)::text AS webpay_unit_price_zar
     FROM presale_invitations i JOIN presale_campaigns c ON c.id = i.campaign_id
     WHERE i.token_hash = $1 AND i.status = 'active' AND (i.expires_at IS NULL OR i.expires_at > now())
       AND c.status = 'active' AND (c.starts_at IS NULL OR c.starts_at <= now()) AND (c.ends_at IS NULL OR c.ends_at > now())`,
    hashSecret(req.inviteToken), WEBPAY_UNIT_PRICE_ZAR,
  );
  if (!row) throw APIError.permissionDenied("This invitation is invalid, expired, or the presale is not active");
  return { offer: offerResponse(row, row.max_shares - row.used_shares, row.invitation_email, row.webpay_unit_price_zar) };
});

function offerResponse(campaign: CampaignRow, invitationSharesRemaining: number, invitationEmail?: string | null, webPayUnitPriceZar = WEBPAY_UNIT_PRICE_ZAR): PresaleOfferResponse {
  return {
    slug: campaign.slug,
    name: campaign.name,
    issuerName: campaign.issuer_name,
    shareClass: campaign.share_class,
    priceUsdt: campaign.price_usdt,
    priceUsd: campaign.price_usd,
    webPayUnitPriceZar,
    usdtPerUsd: campaign.usdt_per_usd,
    network: campaign.network,
    // Payment instructions are issued only after reservation by the locked
    // payment intent. Campaign previews never expose a potentially stale route.
    // Author: Klaasvaakie ( |╲ )
    sharesRemaining: campaign.total_shares - campaign.reserved_shares - campaign.sold_shares,
    invitationSharesRemaining,
    invitationEmail: invitationEmail ?? undefined,
    minConfirmations: campaign.min_confirmations,
    paymentWindowMinutes: campaign.payment_window_minutes,
    termsVersion: PRESALE_TERMS_VERSION,
    isMock: campaign.is_mock,
    startsAt: campaign.starts_at ?? undefined,
    endsAt: campaign.ends_at ?? undefined,
  };
}

export const createPresaleOrder = api<CreatePresaleOrderRequest, { order: PresaleOrderResponse; accessToken: string; emailStatus: "sent" | "failed" | "existing" }>(
  { method: "POST", path: "/presale/orders", expose: true },
  async (request) => {
    const payload = orderInput.parse(request);
    const session = await requirePresaleSession();
    const invitedCampaign = await presaleDb.rawQueryRow<{ is_mock: boolean }>(
      `SELECT c.is_mock FROM presale_invitations i
       JOIN presale_campaigns c ON c.id = i.campaign_id
       WHERE i.token_hash = $1`,
      hashSecret(payload.inviteToken),
    );
    if (!paymentRehearsalAllowed(Boolean(invitedCampaign?.is_mock))) {
      await requireInternationalKycVerified(session.profile.id);
    }
    if (normalizeEmail(payload.buyerEmail) !== normalizeEmail(session.user.email)) {
      throw APIError.permissionDenied("The presale order email must match the authenticated member");
    }
    const idempotencyKey = requestHeader("idempotency-key").trim();
    if (idempotencyKey.length < 16 || idempotencyKey.length > 200) throw APIError.invalidArgument("A valid Idempotency-Key is required");
    const inviteHash = hashSecret(payload.inviteToken);
    const idempotencyHash = hashSecret(idempotencyKey);
    const requestHash = hashSecret(JSON.stringify({
      inviteHash,
      buyerName: payload.buyerName,
      buyerEmail: normalizeEmail(session.user.email),
      buyerPhone: payload.buyerPhone ?? "",
      quantity: payload.quantity,
      paymentRail: payload.paymentRail,
      termsVersion: PRESALE_TERMS_VERSION,
      investorApplicationVersion: INVESTOR_APPLICATION_VERSION,
      investorApplication: payload.investorApplication,
    }));
    const accessToken = crypto.randomUUID() + crypto.randomUUID();
    const tx = await presaleDb.begin();
    try {
      const invitation = await tx.rawQueryRow<{ id: string; campaign_id: string; email: string | null; max_shares: number; used_shares: number; status: string; expires_at: string | null; webpay_unit_price_zar_override: string | null }>(
        `SELECT id, campaign_id, email, max_shares, used_shares, status, expires_at,
                webpay_unit_price_zar_override::text AS webpay_unit_price_zar_override
         FROM presale_invitations WHERE token_hash = $1 FOR UPDATE`, inviteHash);
      if (!invitation) throw APIError.permissionDenied("This invitation is invalid or expired");
      const replay = await tx.rawQueryRow<OrderRow & { request_hash: string }>(
        `SELECT id, order_reference, campaign_id, buyer_name, buyer_email, external_profile_id, quantity,
                payment_rail, unit_price_zar::text AS unit_price_zar, total_zar::text AS total_zar,
                unit_price_usdt::text AS unit_price_usdt,
                total_usdt::text AS total_usdt, unit_price_usd::text AS unit_price_usd, total_usd::text AS total_usd,
                usdt_per_usd::text AS usdt_per_usd, quote_reference, status, payment_deadline, confirmed_at, incorporation_status,
                payment_obligation_id,payment_intent_id,payment_network,payment_receiving_address,payment_token_contract,
                payment_min_confirmations,payment_settled_at,created_at,request_hash
         FROM presale_orders WHERE invitation_id = $1 AND idempotency_key_hash = $2`, invitation.id, idempotencyHash);
      if (replay) {
        if (replay.request_hash !== requestHash) throw APIError.alreadyExists("Idempotency-Key was already used for a different order");
        await tx.rawExec("UPDATE presale_orders SET access_token_hash = $2, updated_at = now() WHERE id = $1", replay.id, hashSecret(accessToken));
        const campaign = await tx.rawQueryRow<CampaignRow>("SELECT * FROM presale_campaigns WHERE id = $1", replay.campaign_id);
        if (!campaign) throw new Error("presale_campaign_not_found");
        await tx.commit();
        const intent = replay.payment_rail === "remitano_usdt" ? await ensurePresalePaymentIntent(replay, campaign) : undefined;
        const emailStatus = await safelyEnsurePresaleReservationCreatedEmail(replay, campaign, intent?.network ?? "webpay");
        return { order: orderResponse(replay, campaign, null, 0, intent), accessToken, emailStatus };
      }
      const existing = await tx.rawQueryRow<OrderRow>(
        `SELECT id, order_reference, campaign_id, buyer_name, buyer_email, external_profile_id, quantity,
                payment_rail, unit_price_zar::text AS unit_price_zar, total_zar::text AS total_zar,
                unit_price_usdt::text AS unit_price_usdt, total_usdt::text AS total_usdt,
                unit_price_usd::text AS unit_price_usd, total_usd::text AS total_usd,
                usdt_per_usd::text AS usdt_per_usd, quote_reference, status, payment_deadline, confirmed_at, incorporation_status,
                payment_obligation_id,payment_intent_id,payment_network,payment_receiving_address,payment_token_contract,
                payment_min_confirmations,payment_settled_at,created_at
         FROM presale_orders
         WHERE invitation_id = $1 AND external_profile_id::text = $2::text
           AND status = 'awaiting_payment' AND payment_deadline > now()
         ORDER BY created_at DESC LIMIT 1 FOR UPDATE`, invitation.id, session.profile.id,
      );
      if (existing) {
        if (existing.quantity !== payload.quantity || existing.payment_rail !== payload.paymentRail) {
          throw APIError.failedPrecondition("An active reservation already exists with a different quantity or payment method");
        }
        await tx.rawExec("UPDATE presale_orders SET access_token_hash = $2, updated_at = now() WHERE id = $1", existing.id, hashSecret(accessToken));
        const campaign = await tx.rawQueryRow<CampaignRow>("SELECT * FROM presale_campaigns WHERE id = $1", existing.campaign_id);
        if (!campaign) throw new Error("presale_campaign_not_found");
        await tx.commit();
        const intent = existing.payment_rail === "remitano_usdt" ? await ensurePresalePaymentIntent(existing, campaign) : undefined;
        const emailStatus = await safelyEnsurePresaleReservationCreatedEmail(existing, campaign, intent?.network ?? "webpay");
        return { order: orderResponse(existing, campaign, null, 0, intent), accessToken, emailStatus };
      }
      if (invitation.status !== "active" || (invitation.expires_at && new Date(invitation.expires_at) <= new Date())) {
        throw APIError.permissionDenied("This invitation is invalid or expired");
      }
      const email = normalizeEmail(session.user.email);
      if (invitation.email && normalizeEmail(invitation.email) !== email) throw APIError.permissionDenied("This invitation belongs to a different email address");
      if (exceedsInvitationShareLimit(invitation.used_shares, payload.quantity, invitation.max_shares)) throw APIError.failedPrecondition("The invitation share limit would be exceeded");
      const campaignBefore = await tx.rawQueryRow<Pick<CampaignRow, "bonus_buy_one_get_one" | "share_phase_number">>("SELECT bonus_buy_one_get_one, share_phase_number FROM presale_campaigns WHERE id = $1 FOR UPDATE", invitation.campaign_id);
      if (!campaignBefore) throw APIError.notFound("Presale campaign not found");
      const issuedQuantity = issuedSharesForPresale(payload.quantity, campaignBefore.bonus_buy_one_get_one);
      const campaign = await tx.rawQueryRow<CampaignRow>(
        `UPDATE presale_campaigns SET reserved_shares = reserved_shares + $2, updated_at = now()
         WHERE id = $1 AND status = 'active' AND (starts_at IS NULL OR starts_at <= now()) AND (ends_at IS NULL OR ends_at > now())
            AND reserved_shares + sold_shares + $2 <= total_shares RETURNING *`, invitation.campaign_id, issuedQuantity);
      if (!campaign) throw APIError.failedPrecondition("The presale is closed or does not have enough shares remaining");
      await tx.rawExec(`UPDATE presale_invitations SET used_shares = used_shares + $2,
        status = CASE WHEN used_shares + $2 = max_shares THEN 'exhausted' ELSE status END WHERE id = $1`, invitation.id, payload.quantity);
      const orderId = crypto.randomUUID();
      const orderReference = `KSP-${crypto.randomUUID().slice(0, 8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
      const quote = quotedUsdtAmount(campaign.price_usd, campaign.usdt_per_usd, payload.quantity);
      const quoteReference = `campaign:${campaign.id}:rate:${campaign.usdt_per_usd}`;
      const encryptedApplication = encryptInvestorApplication(payload.investorApplication);
      const applicationSummary = {
        applicantType: payload.investorApplication.applicantType,
        sourceOfFunds: payload.investorApplication.sourceOfFunds,
        declarationsAccepted: true,
      };
      const order = await tx.rawQueryRow<OrderRow>(
        `INSERT INTO presale_orders
           (id, order_reference, campaign_id, invitation_id, buyer_name, buyer_email, buyer_phone, external_profile_id, quantity,
            unit_price_usdt, total_usdt, unit_price_usd, total_usd, usdt_per_usd, quote_reference, idempotency_key_hash, request_hash, access_token_hash, terms_version,
            terms_accepted_at, investor_application, investor_application_ciphertext, investor_application_nonce,
            investor_application_auth_tag, investor_application_version, investor_application_accepted_at, payment_deadline)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::numeric,$11::numeric,$12::numeric,$13::numeric,$14::numeric,$15,$16,$17,$18,$19,now(),
                  $20::jsonb,$21,$22,$23,$24,now(),now() + ($25::int * interval '1 minute'))
          RETURNING id, order_reference, campaign_id, buyer_name, buyer_email, external_profile_id, quantity,
                    payment_rail, unit_price_zar::text AS unit_price_zar, total_zar::text AS total_zar,
                    unit_price_usdt::text AS unit_price_usdt, total_usdt::text AS total_usdt, unit_price_usd::text AS unit_price_usd,
                    total_usd::text AS total_usd, usdt_per_usd::text AS usdt_per_usd, quote_reference, status,
                    payment_deadline, confirmed_at, incorporation_status,
                    payment_obligation_id,payment_intent_id,payment_network,payment_receiving_address,payment_token_contract,
                    payment_min_confirmations,payment_settled_at,created_at`,
        orderId, orderReference, campaign.id, invitation.id, payload.buyerName.trim(), email, payload.buyerPhone?.trim() ?? null, session.profile.id,
        payload.quantity, quote.unitUsdt, quote.totalUsdt, campaign.price_usd, quote.totalUsd, campaign.usdt_per_usd, quoteReference,
        idempotencyHash, requestHash, hashSecret(accessToken), PRESALE_TERMS_VERSION,
        JSON.stringify(applicationSummary), encryptedApplication.ciphertext, encryptedApplication.nonce,
        encryptedApplication.authTag, INVESTOR_APPLICATION_VERSION, campaign.payment_window_minutes);
      if (!order) throw new Error("presale_order_not_created");
      const webPayUnitPriceZar = invitation.webpay_unit_price_zar_override ?? WEBPAY_UNIT_PRICE_ZAR;
      const totalZar = payload.paymentRail === "webpay_card" ? webPayTotalZar(payload.quantity, webPayUnitPriceZar) : null;
      await tx.rawExec(
        `UPDATE presale_orders SET payment_rail = $2, unit_price_zar = $3::numeric, total_zar = $4::numeric
          WHERE id = $1`,
        order.id,
        payload.paymentRail,
        payload.paymentRail === "webpay_card" ? webPayUnitPriceZar : null,
        totalZar,
      );
      order.payment_rail = payload.paymentRail;
      order.unit_price_zar = payload.paymentRail === "webpay_card" ? webPayUnitPriceZar : null;
      order.total_zar = totalZar;
      if (payload.paymentRail === "webpay_card" && invitation.webpay_unit_price_zar_override) {
        await tx.rawExec("UPDATE presale_invitations SET webpay_unit_price_zar_override = NULL WHERE id = $1", invitation.id);
      }
      await tx.commit();
      const intent = order.payment_rail === "remitano_usdt" ? await ensurePresalePaymentIntent(order, campaign) : undefined;
      const emailStatus = await safelyEnsurePresaleReservationCreatedEmail(order, campaign, intent?.network ?? "webpay");
      return { order: orderResponse(order, campaign, null, 0, intent), accessToken, emailStatus };
    } catch (error) {
      try { await tx.rollback(); } catch { /* transaction may already be closed */ }
      throw error;
    }
  },
);

export const getPresaleOrder = api<
  { orderReference: string },
  { order: PresaleOrderResponse }
>({ method: "GET", path: "/presale/orders/:orderReference", expose: true }, async (req) => {
  // Keep bearer-style order access credentials out of URLs, proxy logs, and browser history.
  // Author: Klaasvaakie ( |╲ )
  const accessToken = requestHeader("x-presale-access-token").trim();
  if (accessToken.length < 32 || accessToken.length > 256) {
    throw APIError.unauthenticated("A valid order access token is required");
  }
  const row = await presaleDb.rawQueryRow<OrderRow & CampaignRow & { campaign_status: string; tx_hash: string | null; confirmations: number | null }>(
    `SELECT o.id, o.order_reference, o.campaign_id, o.buyer_name, o.buyer_email, o.external_profile_id, o.quantity,
            o.payment_rail, o.unit_price_zar::text AS unit_price_zar, o.total_zar::text AS total_zar,
            o.unit_price_usdt::text AS unit_price_usdt, o.total_usdt::text AS total_usdt,
            o.unit_price_usd::text AS unit_price_usd, o.total_usd::text AS total_usd, o.usdt_per_usd::text AS usdt_per_usd, o.quote_reference, o.status,
            o.payment_deadline, o.confirmed_at, o.incorporation_status,
            o.payment_obligation_id,o.payment_intent_id,o.payment_network,o.payment_receiving_address,o.payment_token_contract,
            o.payment_min_confirmations,o.payment_settled_at,o.created_at,
            c.slug, c.name, c.issuer_name, c.share_class, c.status AS campaign_status, c.total_shares,
            c.reserved_shares, c.sold_shares, c.price_usdt::text AS price_usdt, c.price_usd::text AS price_usd, c.usdt_per_usd::text AS usdt_per_usd, c.share_phase_number, c.network, c.token_contract,
            c.receiving_address, c.min_confirmations, c.payment_window_minutes, c.starts_at, c.ends_at,
            o.payment_transaction_hash AS tx_hash, o.payment_confirmations AS confirmations
     FROM presale_orders o JOIN presale_campaigns c ON c.id = o.campaign_id
     WHERE o.order_reference = $1 AND o.access_token_hash = $2`, req.orderReference, hashSecret(accessToken));
  if (!row) throw APIError.notFound("Presale order not found");
  const campaign: CampaignRow = { ...row, status: row.campaign_status };
  return { order: orderResponse(row, campaign, row.tx_hash, row.confirmations ?? 0) };
});

type WebPayCheckoutResponse = {
  actionUrl: string;
  fields: Record<string, string>;
};

export const createPresaleWebPayCheckout = api<
  { orderReference: string },
  WebPayCheckoutResponse
>({ method: "POST", path: "/presale/orders/:orderReference/webpay-checkout", expose: true }, async (req) => {
  const accessToken = requestHeader("x-presale-access-token").trim();
  if (accessToken.length < 32 || accessToken.length > 256) {
    throw APIError.unauthenticated("A valid order access token is required");
  }
  const actionUrl = WebPayCheckoutUrl().trim();
  const notifyUrl = WebPayNotifyUrl().trim();
  if (!actionUrl.startsWith("https://") || !notifyUrl.startsWith("https://")) {
    throw APIError.unavailable("WebPay checkout is not configured");
  }
  const order = await presaleDb.rawQueryRow<{
    id: string; order_reference: string; buyer_name: string; buyer_email: string; buyer_phone: string | null;
    quantity: number; payment_rail: PresalePaymentRail; total_zar: string | null; status: string;
    payment_deadline: string; webpay_transaction_id: string | null; webpay_order_number: string | null;
  }>(
    `SELECT id,order_reference,buyer_name,buyer_email,buyer_phone,quantity,payment_rail,
            total_zar::text AS total_zar,status,payment_deadline,
            webpay_transaction_id::text AS webpay_transaction_id,webpay_order_number
       FROM presale_orders WHERE order_reference = $1 AND access_token_hash = $2`,
    req.orderReference, hashSecret(accessToken),
  );
  if (!order) throw APIError.notFound("Presale order not found");
  if (order.payment_rail !== "webpay_card" || !order.total_zar) {
    throw APIError.failedPrecondition("This reservation is not configured for WebPay");
  }
  if (order.status !== "awaiting_payment" || new Date(order.payment_deadline) <= new Date()) {
    throw APIError.failedPrecondition("This reservation no longer accepts payment");
  }
  const transactionId = order.webpay_transaction_id ?? crypto.randomUUID();
  const orderNumber = order.webpay_order_number ?? webPayOrderNumber("KSH", order.order_reference);
  await presaleDb.rawExec(
    `UPDATE presale_orders SET webpay_transaction_id = $2, webpay_order_number = $3, updated_at = now()
      WHERE id = $1 AND (webpay_transaction_id IS NULL OR webpay_transaction_id = $2)`,
    order.id, transactionId, orderNumber,
  );
  const [firstName, ...surnameParts] = order.buyer_name.trim().split(/\s+/);
  const fields: Record<string, string> = {
    ...webPayMerchantFields({
      merchantUuid: WebPayMerchantUuid(),
      accountUuid: WebPayAccountUuid(),
      siteId: WebPaySiteId(),
      siteName: "KASIHUB ECO",
    }),
    m_tx_order_nr: orderNumber,
    m_tx_id: transactionId,
    m_tx_currency: "ZAR",
    m_tx_amount: order.total_zar,
    m_tx_item_name: "KaSiShares Class B shares",
    m_tx_item_description: `${order.quantity} paid KaSiShares Class B share${order.quantity === 1 ? "" : "s"}`,
    m_card_allowed: "true",
    m_ieft_allowed: "false",
    m_chips_allowed: "false",
    m_trident_allowed: "false",
    m_mpass_allowed: "false",
    m_payat_allowed: "false",
    m_zapper_allowed: "false",
    m_snapscan_allowed: "false",
    b_name: firstName,
    b_email: order.buyer_email,
    m_return_url: "https://shares.kasihub.net/shares/account?payment=webpay",
    m_notify_url: notifyUrl,
    m_process_url: "https://shares.kasihub.net/api/presale/webpay/process",
    m_back2shop_url: "https://shares.kasihub.net/shares/account?payment=cancelled",
  };
  if (surnameParts.length) fields.b_surname = surnameParts.join(" ");
  if (order.buyer_phone) fields.b_mobile = order.buyer_phone;
  fields.checksum = webPayChecksum({
    merchantUuid: fields.m_uuid,
    accountUuid: fields.m_account_uuid,
    transactionId,
    amountZar: order.total_zar,
    securityKey: WebPaySecurityKey(),
  });
  return { actionUrl, fields };
});

export const submitPresalePaymentProof = api<PresalePaymentProofRequest, { orderReference: string; status: string; transactionHash: string }>(
  { method: "POST", path: "/presale/orders/:orderReference/payment-proof", expose: true },
  async (request) => {
    const payload = proofInput.parse(request);
    const order = await presaleDb.rawQueryRow<{ id: string; status: string; external_profile_id: string | null; payment_intent_id: string | null; is_mock: boolean }>(
      `SELECT o.id,o.status,o.external_profile_id,o.payment_intent_id,c.is_mock
       FROM presale_orders o JOIN presale_campaigns c ON c.id = o.campaign_id
       WHERE o.order_reference = $1 AND o.access_token_hash = $2`, payload.orderReference, hashSecret(payload.accessToken));
    if (!order) throw APIError.notFound("Presale order not found");
    if (["confirmed", "expired", "cancelled", "incorporated"].includes(order.status)) throw APIError.failedPrecondition("This order no longer accepts payment proof");
    if (!order.external_profile_id || !order.payment_intent_id) throw APIError.failedPrecondition("This order does not have a payment intent");
    const attempt = await submitPaymentAttempt({
      intentId: order.payment_intent_id,
      profileId: order.external_profile_id,
      transactionHash: payload.txHash,
      submittedSenderWallet: payload.senderAddress,
    });
    await presaleDb.rawExec(`UPDATE presale_orders SET status = CASE WHEN status = 'awaiting_payment' THEN 'payment_submitted' ELSE status END,
      updated_at = now() WHERE id = $1`, order.id);
    const rehearsal = paymentRehearsalAllowed(order.is_mock);
    const verification = await verifyAndSettlePaymentAttempt(
      attempt.id,
      rehearsal
        ? (network, transactionHash) => readPaymentRehearsalEvidence(attempt.id, network, transactionHash)
        : undefined,
    );
    if (rehearsal && verification.status === "settled") await recordPaymentRehearsal(attempt.id);
    if (verification.status === "settled") {
      if (verification.subjectType !== "presale_order" || verification.subjectReference !== payload.orderReference) {
        throw APIError.failedPrecondition("Settled payment subject does not match this presale order");
      }
      await fulfilSettledPresalePayment(payload.orderReference, verification.paymentIntentId, verification.transactionHash, verification.confirmations);
    } else if (verification.status === "rejected") {
      await cancelPaymentObligation({ obligationId: verification.obligationId, reason: `Rejected chain evidence for ${payload.orderReference}` });
      await rejectPresalePayment(payload.orderReference, verification.paymentIntentId);
    } else if (["pending_confirmations", "underpaid", "manual_review"].includes(verification.status)) {
      await presaleDb.rawExec("UPDATE presale_orders SET status = 'payment_detected', updated_at = now() WHERE id = $1", order.id);
    }
    return { orderReference: payload.orderReference, status: verification.status, transactionHash: attempt.transactionHash };
  },
);

export const receivePresalePaymentEvent = api<PresalePaymentEventRequest, { accepted: true; outcome: string; orderReference?: string }>(
  { method: "POST", path: "/presale/webhooks/usdt", expose: true },
  async (request) => {
    const event = paymentEventInput.parse(request) as PaymentEvent;
    const signature = requestHeader("x-presale-signature").trim();
    if (!verifyPaymentEvent(event, PresaleWebhookSecret(), signature)) throw APIError.unauthenticated("Invalid presale webhook signature");
    await presaleDb.rawExec(`INSERT INTO presale_payment_events (provider, provider_event_id, tx_hash, payload, outcome)
      VALUES ($1,$2,$3,$4::jsonb,'ignored_requires_chain_verification') ON CONFLICT (provider, provider_event_id) DO NOTHING`,
      event.provider, event.eventId, event.txHash.toLowerCase(), JSON.stringify(event));
    return { accepted: true, outcome: "ignored_requires_chain_verification", orderReference: event.orderReference };
  },
);

export const cancelPresaleOrder = api<
  { orderReference: string; acknowledgeNoPaymentSent: boolean },
  { orderReference: string; status: "cancelled"; cancelledCount: number }
>({ method: "POST", path: "/presale/orders/:orderReference/cancel", expose: true }, async (request) => {
  const session = await requirePresaleSession();
  if (request.acknowledgeNoPaymentSent !== true) {
    throw APIError.invalidArgument("Confirm that no card payment or crypto transfer was sent before cancelling");
  }
  const tx = await presaleDb.begin();
  let obligations: string[] = [];
  try {
    const target = await tx.rawQueryRow<{ invitation_id: string; status: string; webpay_transaction_id: string | null }>(
      `SELECT invitation_id,status,webpay_transaction_id FROM presale_orders
       WHERE order_reference = $1 AND external_profile_id::text = $2::text FOR UPDATE`,
      request.orderReference, session.profile.id,
    );
    if (!target) throw APIError.notFound("Reservation not found");
    if (target.status !== "awaiting_payment") throw APIError.failedPrecondition("Only an unpaid reservation can be cancelled");
    if (target.webpay_transaction_id) throw APIError.failedPrecondition("WebPay checkout has already started; contact support before changing payment method");

    // Cancel every unpaid duplicate created for the same applicant invitation. This repairs historical
    // post-commit retry duplicates and preserves one clear business action for the applicant.
    const orders = await tx.rawQueryAll<{
      id: string; campaign_id: string; invitation_id: string; quantity: number;
      payment_obligation_id: string | null; bonus_buy_one_get_one: boolean;
    }>(
      `SELECT o.id,o.campaign_id,o.invitation_id,o.quantity,o.payment_obligation_id,c.bonus_buy_one_get_one
       FROM presale_orders o JOIN presale_campaigns c ON c.id = o.campaign_id
       WHERE o.invitation_id = $1 AND o.external_profile_id::text = $2::text
         AND o.status = 'awaiting_payment' AND o.webpay_transaction_id IS NULL
       ORDER BY o.created_at FOR UPDATE OF o`, target.invitation_id, session.profile.id,
    );
    if (orders.length === 0) throw APIError.failedPrecondition("No cancellable unpaid reservation remains");
    obligations = orders.flatMap((order) => order.payment_obligation_id ? [order.payment_obligation_id] : []);
    for (const order of orders) {
      const issuedQuantity = issuedSharesForPresale(order.quantity, order.bonus_buy_one_get_one);
      const released = await tx.rawQueryRow<{ id: string }>(
        "UPDATE presale_campaigns SET reserved_shares = reserved_shares - $2, updated_at = now() WHERE id = $1 AND reserved_shares >= $2 RETURNING id",
        order.campaign_id, issuedQuantity,
      );
      if (!released) throw APIError.failedPrecondition("Reservation accounting is inconsistent; contact support");
      const invitation = await tx.rawQueryRow<{ id: string }>(
        `UPDATE presale_invitations SET used_shares = used_shares - $2,
           status = CASE WHEN status = 'exhausted' THEN 'active' ELSE status END
         WHERE id = $1 AND used_shares >= $2 RETURNING id`, order.invitation_id, order.quantity,
      );
      if (!invitation) throw APIError.failedPrecondition("Invitation accounting is inconsistent; contact support");
      await tx.rawExec("UPDATE presale_orders SET status = 'cancelled', updated_at = now() WHERE id = $1", order.id);
    }
    await tx.commit();
    for (const obligationId of obligations) {
      try {
        await cancelPaymentObligation({ obligationId, reason: `Applicant cancelled reservation ${request.orderReference} before payment` });
      } catch (error) {
        log.error(error, "cancelled presale order obligation cleanup failed", { obligationId, orderReference: request.orderReference });
      }
    }
    return { orderReference: request.orderReference, status: "cancelled", cancelledCount: orders.length };
  } catch (error) {
    try { await tx.rollback(); } catch { /* transaction may already be closed */ }
    throw error;
  }
});

export const receivePresaleWebPayNotification = api<
  WebPayNotificationRequest,
  { accepted: true; outcome: string; orderReference: string }
>({ method: "POST", path: "/presale/webhooks/webpay", expose: true }, async (request) => {
  const event = webPayNotificationInput.parse(request);
  const amount = Number(event.requestAmount);
  if (!Number.isFinite(amount) || amount <= 0) throw APIError.invalidArgument("Invalid WebPay amount");
  const requestedAmount = amount.toFixed(2);
  if (event.payeeSiteId !== WebPaySiteId()
    || event.payeeUuid !== WebPayMerchantUuid()
    || event.payeeAccountUuid !== WebPayAccountUuid()) {
    throw APIError.unauthenticated("WebPay merchant identity does not match");
  }
  if (!verifyWebPayChecksum({
    merchantUuid: event.payeeUuid,
    accountUuid: event.payeeAccountUuid,
    transactionId: event.payeeRefInfo,
    amountZar: requestedAmount,
    securityKey: WebPaySecurityKey(),
  }, event.checksum)) throw APIError.unauthenticated("Invalid WebPay notification checksum");

  const order = await presaleDb.rawQueryRow<{
    id: string; order_reference: string; payment_rail: PresalePaymentRail; total_zar: string | null;
    webpay_transaction_id: string | null; webpay_order_number: string | null; status: string;
  }>(`SELECT id,order_reference,payment_rail,total_zar::text AS total_zar,
             webpay_transaction_id::text AS webpay_transaction_id,webpay_order_number,status
        FROM presale_orders
       WHERE webpay_transaction_id::text = $1 OR webpay_order_number = $1`, event.payeeRefInfo);
  if (!order || order.payment_rail !== "webpay_card" || order.webpay_order_number !== event.payeeOrderNr) {
    throw APIError.failedPrecondition("WebPay notification does not match a reservation");
  }
  if (order.total_zar !== requestedAmount) throw APIError.failedPrecondition("WebPay amount does not match the reservation");
  const providerReference = event.paymentSystemReference ?? `${event.requestTokenId}:${event.requestStatus}`;
  const eventId = `${event.requestTokenId}:${event.requestStatus}`;
  await presaleDb.rawExec(`INSERT INTO presale_payment_events (provider,provider_event_id,tx_hash,payload,outcome)
    VALUES ('webpay',$1,$2,$3::jsonb,$4) ON CONFLICT (provider,provider_event_id) DO NOTHING`,
  eventId, providerReference, JSON.stringify(event), event.requestStatus.toLowerCase());

  if (event.requestStatus !== "COMPLETED") {
    return { accepted: true, outcome: event.requestStatus.toLowerCase(), orderReference: order.order_reference };
  }
  const paidAmount = Number(event.paymentAmount);
  if (!Number.isFinite(paidAmount) || paidAmount.toFixed(2) !== requestedAmount
    || event.paymentCurrency !== "ZAR" || !event.paymentMethod?.startsWith("CARD")) {
    throw APIError.failedPrecondition("Completed WebPay payment evidence does not match the reservation");
  }
  await fulfilWebPayPresalePayment(order.order_reference, providerReference, event.paymentMethod);
  return { accepted: true, outcome: "confirmed", orderReference: order.order_reference };
});

export const receivePresaleWebPayProcessNotification = api<
  WebPayProcessNotificationRequest,
  { accepted: true; outcome: string; orderReference: string }
>({ method: "POST", path: "/presale/webhooks/webpay-process", expose: true }, async (request) => {
  const event = webPayProcessNotificationInput.parse(request);
  if (event.payeeAccountUuid !== WebPayAccountUuid()) {
    throw APIError.unauthenticated("WebPay process account does not match");
  }
  if (!verifyWebPayProcessChecksum({
    accountUuid: event.payeeAccountUuid,
    processUuid: event.processUuid,
    processStage: event.processStage,
    securityKey: WebPaySecurityKey(),
  }, event.checksum)) throw APIError.unauthenticated("Invalid WebPay process checksum");

  const order = await presaleDb.rawQueryRow<{ id: string; order_reference: string; payment_rail: PresalePaymentRail }>(
    "SELECT id,order_reference,payment_rail FROM presale_orders WHERE webpay_order_number = $1",
    event.processOrderNo,
  );
  if (!order || order.payment_rail !== "webpay_card") {
    throw APIError.failedPrecondition("WebPay process notification does not match a reservation");
  }
  const eventId = `${event.processUuid}:${event.processStage}:${event.processStatus}`;
  await presaleDb.rawExec(
    `INSERT INTO presale_payment_events (provider,provider_event_id,tx_hash,payload,outcome)
     VALUES ('webpay_process',$1,$2,$3::jsonb,$4) ON CONFLICT (provider,provider_event_id) DO NOTHING`,
    eventId, event.processUuid, JSON.stringify(event), event.processStatus.toLowerCase(),
  );
  await presaleDb.rawExec(
    `UPDATE presale_orders SET webpay_process_uuid = $2, webpay_process_stage = $3,
            webpay_process_status = $4, webpay_process_updated_at = now(), updated_at = now()
      WHERE id = $1 AND status = 'awaiting_payment'`,
    order.id, event.processUuid, event.processStage, event.processStatus,
  );
  return { accepted: true, outcome: event.processStatus.toLowerCase(), orderReference: order.order_reference };
});

export const upsertPresaleCampaign = api<UpsertPresaleCampaignRequest, { campaignId: string; status: string }>(
  { method: "POST", path: "/admin/presale/campaigns", expose: true },
  async (request) => {
    await requireAdminAccess();
    const payload = campaignInput.parse(request);
    if (payload.endsAt && payload.startsAt && new Date(payload.endsAt) <= new Date(payload.startsAt)) throw APIError.invalidArgument("Campaign end must be after its start");
    if (payload.status === "active" && payload.isMock && !paymentRehearsalAllowed(true)) {
      throw APIError.invalidArgument("A mock campaign cannot be activated in production");
    }
    const activeRoute = payload.status === "active"
      ? await resolveActiveReceivingConfiguration(payload.network, "USDT")
      : null;
    const row = await presaleDb.rawQueryRow<{ id: string; status: string }>(
      `INSERT INTO presale_campaigns
        (slug,name,issuer_name,share_class,status,total_shares,price_usdt,price_usd,usdt_per_usd,share_phase_number,network,token_contract,receiving_address,
         min_confirmations,payment_window_minutes,bonus_buy_one_get_one,is_mock,starts_at,ends_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7::numeric,$8::numeric,$9::numeric,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, issuer_name = EXCLUDED.issuer_name,
         share_class = EXCLUDED.share_class, status = EXCLUDED.status,
         total_shares = EXCLUDED.total_shares, price_usdt = EXCLUDED.price_usdt, price_usd = EXCLUDED.price_usd, usdt_per_usd = EXCLUDED.usdt_per_usd, share_phase_number = EXCLUDED.share_phase_number, network = EXCLUDED.network,
         token_contract = EXCLUDED.token_contract, receiving_address = EXCLUDED.receiving_address,
         min_confirmations = EXCLUDED.min_confirmations, payment_window_minutes = EXCLUDED.payment_window_minutes,
         bonus_buy_one_get_one = EXCLUDED.bonus_buy_one_get_one,
         is_mock = EXCLUDED.is_mock,
         starts_at = EXCLUDED.starts_at, ends_at = EXCLUDED.ends_at, updated_at = now()
       WHERE presale_campaigns.total_shares >= presale_campaigns.reserved_shares + presale_campaigns.sold_shares
         AND EXCLUDED.total_shares >= presale_campaigns.reserved_shares + presale_campaigns.sold_shares
       RETURNING id, status`,
      payload.slug, payload.name, payload.issuerName, payload.shareClass, payload.status, payload.totalShares,
      (payload.priceUsd * payload.usdtPerUsd).toFixed(6), payload.priceUsd.toFixed(6), payload.usdtPerUsd.toFixed(6), payload.sharePhaseNumber,
      payload.network, payload.isMock ? null : activeRoute?.tokenContract ?? payload.tokenContract ?? null,
      payload.isMock ? null : activeRoute?.addressReference ?? payload.receivingAddress ?? null,
      activeRoute?.minimumConfirmations ?? payload.minConfirmations, payload.paymentWindowMinutes, payload.bonusBuyOneGet, payload.isMock,
      payload.startsAt ?? null, payload.endsAt ?? null);
    if (!row) throw APIError.failedPrecondition("Total shares cannot be lower than current reserved and sold shares");
    return { campaignId: row.id, status: row.status };
  },
);

/**
 * Read-only operating view for administrators. Route details remain admin-only
 * because they are payment instructions, not a public campaign catalogue.
 * ( |╲ ) — Klaasvaakie
 */
export const listAdminPresaleCampaigns = api<void, { campaigns: PresaleCampaignSummary[] }>(
  { method: "GET", path: "/admin/presale/campaigns", expose: true },
  async () => {
    await requireAdminAccess();
    const campaigns = await presaleDb.rawQueryAll<CampaignRow>(
      "SELECT * FROM presale_campaigns ORDER BY created_at DESC",
    );
    return { campaigns: campaigns.map((campaign) => campaignSummary(campaign, true)) };
  },
);

/**
 * Members may see the offer status and economics, but payment instructions
 * remain invitation-bound. This endpoint never exposes a receiver or token.
 * ( |╲ ) — Klaasvaakie
 */
export const listActivePresaleCampaigns = api<void, { campaigns: PresaleCampaignSummary[] }>(
  { method: "GET", path: "/presale/campaigns", expose: true },
  async () => {
    const campaigns = await presaleDb.rawQueryAll<CampaignRow>(
      `SELECT * FROM presale_campaigns
        WHERE status = 'active'
          AND (starts_at IS NULL OR starts_at <= now())
          AND (ends_at IS NULL OR ends_at > now())
        ORDER BY starts_at NULLS FIRST, created_at DESC`,
    );
    return { campaigns: campaigns.map((campaign) => campaignSummary(campaign, false)) };
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
            o.payment_deadline,o.confirmed_at,o.incorporation_status,o.created_at,
            o.payment_transaction_hash AS tx_hash,o.payment_confirmations AS confirmations
     FROM presale_orders o
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
    const rows = await tx.rawQueryAll<{ id: string; order_reference: string; buyer_name: string; buyer_email: string; quantity: number; total_usdt: string; tx_hash: string; bonus_buy_one_get_one: boolean }>(
      `SELECT o.id,o.order_reference,o.buyer_name,o.buyer_email,o.quantity,o.total_usdt::text AS total_usdt,o.payment_transaction_hash AS tx_hash,c.bonus_buy_one_get_one
       FROM presale_orders o JOIN presale_campaigns c ON c.id = o.campaign_id
       WHERE o.campaign_id = $1 AND o.status = 'confirmed' AND o.incorporation_status = 'pending'
         AND o.payment_settled_at IS NOT NULL AND o.payment_transaction_hash IS NOT NULL
       ORDER BY o.created_at,o.id FOR UPDATE OF o`, req.campaignId);
    if (rows.length === 0) throw APIError.failedPrecondition("No confirmed presale orders are ready for incorporation");
    const orders = rows.map((row) => ({ presaleOrderId: row.id, orderReference: row.order_reference, buyerName: row.buyer_name,
      buyerEmail: row.buyer_email, quantity: row.quantity, paidUsdt: row.total_usdt, transactionHash: row.tx_hash }));
    const manifestHash = hashSecret(JSON.stringify(orders));
    const batchId = crypto.randomUUID();
    const totalShares = rows.reduce((sum, row) => sum + issuedSharesForPresale(row.quantity, row.bonus_buy_one_get_one), 0);
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

/**
 * Applies a prepared batch to the separate shares ledger. The unique presale
 * order reference on the target ledger makes retry safe if either database is
 * interrupted between the two commits.
 * Author: Klaasvaakie ( |╲ )
 */
export const applyPresaleIncorporation = api<
  { batchId: string },
  { batchId: string; incorporated: number; alreadyIncorporated: number }
>({ method: "POST", path: "/admin/presale/incorporation-batches/:batchId/apply", expose: true }, async (req) => {
  await requireAdminAccess();
  const batch = await presaleDb.rawQueryRow<{ id: string; status: string }>(
    "SELECT id, status FROM presale_incorporation_batches WHERE id = $1", req.batchId);
  if (!batch) throw APIError.notFound("Presale incorporation batch not found");
  if (batch.status === "cancelled") throw APIError.failedPrecondition("This incorporation batch is cancelled");
  const orders = await presaleDb.rawQueryAll<{
    id: string; order_reference: string; external_profile_id: string | null; quantity: number; total_usd: string;
    bonus_buy_one_get_one: boolean; share_phase_number: number;
  }>(`SELECT o.id, o.order_reference, o.external_profile_id, o.quantity, o.total_usd::text AS total_usd,
       c.bonus_buy_one_get_one, c.share_phase_number
      FROM presale_orders o JOIN presale_campaigns c ON c.id = o.campaign_id
     WHERE o.incorporation_batch_id = $1 AND o.incorporation_status = 'batched' AND o.status = 'confirmed'
     ORDER BY o.created_at, o.id`, req.batchId);
  let incorporated = 0;
  let alreadyIncorporated = 0;
  for (const order of orders) {
    if (!order.external_profile_id) throw APIError.failedPrecondition(`Order ${order.order_reference} has no authenticated member profile`);
    const issuedQuantity = issuedSharesForPresale(order.quantity, order.bonus_buy_one_get_one);
    const shareTx = await sharesDb.begin();
    try {
      const existing = await shareTx.rawQueryRow<{ id: string }>("SELECT id FROM share_purchases WHERE presale_order_reference = $1 FOR UPDATE", order.order_reference);
      let purchaseId = existing?.id;
      if (existing) {
        alreadyIncorporated += 1;
      } else {
        // A paused retail phase must still honour an already-paid presale allocation
        // through this administrator-controlled incorporation path. Closed phases fail shut.
        // Author: Klaasvaakie ( |╲ )
        const phase = await shareTx.rawQueryRow<{ id: string }>(`UPDATE share_phases SET quantity_available = quantity_available - $2
          WHERE phase_number = $1 AND status IN ('active', 'paused') AND quantity_available >= $2 RETURNING id`, order.share_phase_number, issuedQuantity);
        if (!phase) throw APIError.failedPrecondition(`Share phase ${order.share_phase_number} cannot fulfil ${issuedQuantity} shares`);
        purchaseId = crypto.randomUUID();
        await shareTx.rawExec(`INSERT INTO share_purchases
          (id, profile_id, phase_id, quantity, bonus_quantity, total_amount, status, presale_order_reference, source)
          VALUES ($1,$2,$3,$4,$5,$6::numeric,'paid',$7,'presale')`, purchaseId, order.external_profile_id, phase.id, order.quantity,
          issuedQuantity - order.quantity, order.total_usd, order.order_reference);
        await shareTx.rawExec(`INSERT INTO share_certificates
          (profile_id, certificate_number, total_shares, status, issued_at, presale_order_reference, source)
          VALUES ($1,$2,$3,'issued',now(),$4,'presale')`, order.external_profile_id,
          `CERT-PRESALE-${order.order_reference}`, issuedQuantity, order.order_reference);
        incorporated += 1;
      }
      await shareTx.commit();
      await presaleDb.rawExec(`UPDATE presale_orders SET incorporation_status = 'incorporated', incorporation_batch_id = $2,
        target_purchase_id = $3, status = 'incorporated', updated_at = now() WHERE id = $1`, order.id, req.batchId, purchaseId);
    } catch (error) {
      await shareTx.rollback();
      throw error;
    }
  }
  await presaleDb.rawExec(`UPDATE presale_incorporation_batches SET status = 'applied', applied_at = COALESCE(applied_at, now())
    WHERE id = $1 AND NOT EXISTS (SELECT 1 FROM presale_orders WHERE incorporation_batch_id = $1 AND incorporation_status = 'batched')`, req.batchId);
  return { batchId: req.batchId, incorporated, alreadyIncorporated };
});

export const expirePresaleOrders = api<void, { expired: number }>(
  { method: "POST", path: "/internal/presale/expire-orders", expose: false },
  async () => {
    const tx = await presaleDb.begin();
    try {
      const rows = await tx.rawQueryAll<{ id: string; campaign_id: string; invitation_id: string; quantity: number; bonus_buy_one_get_one: boolean }>(
        `UPDATE presale_orders SET status = 'expired', updated_at = now()
         WHERE status = 'awaiting_payment' AND payment_deadline < now()
         RETURNING id,campaign_id,invitation_id,quantity,
           (SELECT bonus_buy_one_get_one FROM presale_campaigns WHERE id = presale_orders.campaign_id) AS bonus_buy_one_get_one`);
      for (const row of rows) {
        await tx.rawExec("UPDATE presale_campaigns SET reserved_shares = reserved_shares - $2, updated_at = now() WHERE id = $1", row.campaign_id, issuedSharesForPresale(row.quantity, row.bonus_buy_one_get_one));
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

export const reconcileConfirmedPresaleOrders = api<void, { incorporated: number; alreadyIncorporated: number; failed: number }>(
  { method: "POST", path: "/internal/presale/reconcile-incorporation", expose: false },
  async () => {
    const rows = await presaleDb.rawQueryAll<{ order_reference: string }>(`SELECT order_reference FROM presale_orders
      WHERE status='confirmed' AND incorporation_status='pending' AND payment_settled_at IS NOT NULL
      ORDER BY confirmed_at,created_at LIMIT 100`);
    let incorporated = 0;
    let alreadyIncorporated = 0;
    let failed = 0;
    for (const row of rows) {
      try {
        const result = await incorporateConfirmedPresaleOrder(row.order_reference);
        if (result.incorporated) incorporated += 1;
        else alreadyIncorporated += 1;
      } catch (error) {
        failed += 1;
        log.error(error, "confirmed presale incorporation reconciliation failed", { orderReference: row.order_reference });
      }
    }
    return { incorporated, alreadyIncorporated, failed };
  },
);

const presaleExpiryJob = new CronJob("presale-order-expiry", {
  title: "Release expired presale reservations",
  every: "5m",
  endpoint: expirePresaleOrders,
});
void presaleExpiryJob;

const presaleIncorporationJob = new CronJob("presale-incorporation-reconciliation", {
  title: "Issue confirmed presale allocations",
  every: "5m",
  endpoint: reconcileConfirmedPresaleOrders,
});
void presaleIncorporationJob;
