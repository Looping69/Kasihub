// Author: Klaasvaakie ( |╲ )
import { api, APIError } from "encore.dev/api";
import { secret } from "encore.dev/config";
import { CronJob } from "encore.dev/cron";
import { createCipheriv, createHash as createNodeHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { presaleDb, sharesDb } from "../../resources";
import { requestHeader, requireSession } from "../auth/access";
import { requireAdminAccess } from "../auth/access";
import { requireInternationalKycVerified } from "../kyc/policy";
import { submitPaymentAttempt } from "../payments/attempts";
import { createPaymentIntent, type PaymentIntentResponse } from "../payments/intents";
import { cancelPaymentObligation, createPaymentObligation } from "../payments/obligations";
import { resolveActiveReceivingConfiguration } from "../payments/registry";
import { verifyAndSettlePaymentAttempt } from "../payments/verification";
import {
  hashSecret,
  normalizeEmail,
  PaymentEvent,
  INVESTOR_APPLICATION_VERSION,
  PRESALE_TERMS_VERSION,
  verifyPaymentEvent,
} from "./model";
import { issuedSharesForPresale, quotedUsdtAmount } from "./settlement";
import { INVESTOR_APPLICATION_SCHEMA_VERSION, phaseOneApplicantSchema, type PhaseOneApplicant } from "./application";

const PresaleWebhookSecret = secret("PresaleWebhookSecret");
const InvestorApplicationEncryptionKey = secret("InvestorApplicationEncryptionKey");

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
  if (value.buyerPhone?.trim() !== value.investorApplication.confirmMobileNumber) {
    context.addIssue({ code: "custom", path: ["investorApplication", "confirmMobileNumber"], message: "Cellphone numbers must match" });
  }
  if (value.investorApplication.applicantType !== "individual") {
    for (const field of ["entityRegistrationNumber", "authorisedRepresentativeName", "authorisedRepresentativePosition"] as const) {
      if (!value.investorApplication[field]?.trim()) context.addIssue({ code: "custom", path: ["investorApplication", field], message: `${field} is required` });
    }
  }
});

const createApplicationInput = z.object({
  inviteToken: z.string().min(32).max(256),
  applicantType: z.enum(["individual", "company", "trust"]),
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
  termsAccepted: boolean;
  investorApplication: {
    applicantType: "individual" | "company" | "trust";
    dateOfBirth?: string;
    nationality: string;
    occupation?: string;
    employer?: string;
    alternativePhone?: string;
    postalAddress?: string;
    taxNumber?: string;
    taxResidenceCountry: string;
    tin?: string;
    additionalTaxJurisdictions?: string;
    entityRegistrationNumber?: string;
    vatNumber?: string;
    authorisedRepresentativeName?: string;
    authorisedRepresentativePosition?: string;
    beneficialOwnerName: string;
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
  } catch (error) {
    try { await tx.rollback(); } catch { /* transaction may already be closed */ }
    throw error;
  }
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

export const createPresaleApplication = api<CreatePresaleApplicationRequest, { application: ApplicationDraftResponse }>(
  { method: "POST", path: "/presale/applications", expose: true },
  async (request) => {
    const payload = createApplicationInput.parse(request);
    const session = await requireSession();
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
    const session = await requireSession();
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
      await tx.rollback();
      throw error;
    }
  },
);

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
    priceUsd: campaign.price_usd,
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
    startsAt: campaign.starts_at ?? undefined,
    endsAt: campaign.ends_at ?? undefined,
  };
}

export const createPresaleOrder = api<CreatePresaleOrderRequest, { order: PresaleOrderResponse; accessToken: string }>(
  { method: "POST", path: "/presale/orders", expose: true },
  async (request) => {
    const payload = orderInput.parse(request);
    const session = await requireSession();
    await requireInternationalKycVerified(session.profile.id);
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
      termsVersion: PRESALE_TERMS_VERSION,
      investorApplicationVersion: INVESTOR_APPLICATION_VERSION,
      investorApplication: payload.investorApplication,
    }));
    const accessToken = crypto.randomUUID() + crypto.randomUUID();
    const tx = await presaleDb.begin();
    try {
      const invitation = await tx.rawQueryRow<{ id: string; campaign_id: string; email: string | null; max_shares: number; used_shares: number; status: string; expires_at: string | null }>(
        `SELECT id, campaign_id, email, max_shares, used_shares, status, expires_at
         FROM presale_invitations WHERE token_hash = $1 FOR UPDATE`, inviteHash);
      if (!invitation) throw APIError.permissionDenied("This invitation is invalid or expired");
      const replay = await tx.rawQueryRow<OrderRow & { request_hash: string }>(
        `SELECT id, order_reference, campaign_id, buyer_name, buyer_email, external_profile_id, quantity, unit_price_usdt::text AS unit_price_usdt,
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
        const intent = await ensurePresalePaymentIntent(replay, campaign);
        return { order: orderResponse(replay, campaign, null, 0, intent), accessToken };
      }
      if (invitation.status !== "active" || (invitation.expires_at && new Date(invitation.expires_at) <= new Date())) {
        throw APIError.permissionDenied("This invitation is invalid or expired");
      }
      const email = normalizeEmail(session.user.email);
      if (invitation.email && normalizeEmail(invitation.email) !== email) throw APIError.permissionDenied("This invitation belongs to a different email address");
      if (invitation.used_shares + payload.quantity > invitation.max_shares) throw APIError.failedPrecondition("The invitation share limit would be exceeded");
      const campaignBefore = await tx.rawQueryRow<Pick<CampaignRow, "bonus_buy_one_get_one" | "share_phase_number">>("SELECT bonus_buy_one_get_one, share_phase_number FROM presale_campaigns WHERE id = $1 FOR UPDATE", invitation.campaign_id);
      if (!campaignBefore) throw APIError.notFound("Presale campaign not found");
      if (campaignBefore.share_phase_number === 1 && payload.quantity > 300) {
        throw APIError.invalidArgument("Phase 1 applications are limited to 300 paid shares");
      }
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
      await tx.commit();
      const intent = await ensurePresalePaymentIntent(order, campaign);
      return { order: orderResponse(order, campaign, null, 0, intent), accessToken };
    } catch (error) {
      await tx.rollback();
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

export const submitPresalePaymentProof = api<PresalePaymentProofRequest, { orderReference: string; status: string; transactionHash: string }>(
  { method: "POST", path: "/presale/orders/:orderReference/payment-proof", expose: true },
  async (request) => {
    const payload = proofInput.parse(request);
    const order = await presaleDb.rawQueryRow<{ id: string; status: string; external_profile_id: string | null; payment_intent_id: string | null }>(
      `SELECT o.id,o.status,o.external_profile_id,o.payment_intent_id
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
    const verification = await verifyAndSettlePaymentAttempt(attempt.id);
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

export const upsertPresaleCampaign = api<UpsertPresaleCampaignRequest, { campaignId: string; status: string }>(
  { method: "POST", path: "/admin/presale/campaigns", expose: true },
  async (request) => {
    await requireAdminAccess();
    const payload = campaignInput.parse(request);
    if (payload.endsAt && payload.startsAt && new Date(payload.endsAt) <= new Date(payload.startsAt)) throw APIError.invalidArgument("Campaign end must be after its start");
    if (payload.status === "active" && payload.isMock) throw APIError.invalidArgument("A mock campaign cannot be activated");
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
        const phase = await shareTx.rawQueryRow<{ id: string }>(`UPDATE share_phases SET quantity_available = quantity_available - $2
          WHERE phase_number = $1 AND status = 'active' AND quantity_available >= $2 RETURNING id`, order.share_phase_number, issuedQuantity);
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

const presaleExpiryJob = new CronJob("presale-order-expiry", {
  title: "Release expired presale reservations",
  every: "5m",
  endpoint: expirePresaleOrders,
});
void presaleExpiryJob;
