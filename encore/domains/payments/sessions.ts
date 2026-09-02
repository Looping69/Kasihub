// Author: Klaasvaakie ( |\ )
import { api, APIError } from "encore.dev/api";
import { z } from "zod";
import { paymentsDb } from "../../resources";
import { PAYMENT_PROVIDERS, providerCapabilities, type PaymentProviderId } from "./provider-contract";

export interface RegisterPaymentSessionRequest {
  obligationId: string;
  provider: PaymentProviderId;
  providerSessionId: string;
  providerReference?: string;
  providerPaymentUrl?: string;
  expiresAt?: string;
  metadata?: Record<string, unknown>;
}

export type PaymentSessionResponse = {
  id: string;
  obligationId: string;
  subjectType: string;
  subjectReference: string;
  provider: PaymentProviderId;
  providerSessionId: string;
  providerReference?: string;
  providerPaymentUrl?: string;
  amount: string;
  currency: string;
  status: string;
  expiresAt?: string;
};

const registerSessionRequest = z.object({
  obligationId: z.string().uuid(),
  provider: z.enum(PAYMENT_PROVIDERS),
  providerSessionId: z.string().min(1).max(300),
  providerReference: z.string().min(1).max(300).optional(),
  providerPaymentUrl: z.string().url().max(2000).optional(),
  expiresAt: z.iso.datetime().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

type SessionRow = {
  id: string; obligation_id: string; subject_type: string; subject_reference: string;
  provider: PaymentProviderId; provider_session_id: string; provider_reference: string | null;
  provider_payment_url: string | null; amount: string; currency: string; status: string; expires_at: string | null;
};

const SESSION_SELECT = `SELECT s.id,s.obligation_id,o.subject_type,o.subject_reference,s.provider,
  s.provider_session_id,s.provider_reference,s.provider_payment_url,s.amount::text AS amount,
  s.currency,s.status,s.expires_at
  FROM payment_sessions s JOIN payment_obligations o ON o.id=s.obligation_id`;

function mapSession(row: SessionRow): PaymentSessionResponse {
  return {
    id: row.id, obligationId: row.obligation_id, subjectType: row.subject_type,
    subjectReference: row.subject_reference, provider: row.provider,
    providerSessionId: row.provider_session_id,
    ...(row.provider_reference ? { providerReference: row.provider_reference } : {}),
    ...(row.provider_payment_url ? { providerPaymentUrl: row.provider_payment_url } : {}),
    amount: row.amount, currency: row.currency, status: row.status,
    ...(row.expires_at ? { expiresAt: row.expires_at } : {}),
  };
}

export async function registerPaymentSession(req: RegisterPaymentSessionRequest): Promise<PaymentSessionResponse> {
  const payload = registerSessionRequest.parse(req);
  const capability = providerCapabilities[payload.provider];
  if (!capability.enabled) throw APIError.failedPrecondition(capability.reason ?? "payment_provider_disabled");
  const obligation = await paymentsDb.rawQueryRow<{
    settlement_amount: string; settlement_currency: string; status: string;
  }>(`SELECT settlement_amount::text AS settlement_amount,settlement_currency,status
      FROM payment_obligations WHERE id=$1`, payload.obligationId);
  if (!obligation) throw APIError.notFound("Payment obligation not found");
  if (!["open", "partially_paid"].includes(obligation.status)) {
    throw APIError.failedPrecondition(`Payment obligation is ${obligation.status}`);
  }
  const existing = await paymentsDb.rawQueryRow<SessionRow>(
    `${SESSION_SELECT} WHERE s.provider=$1 AND s.provider_session_id=$2`,
    payload.provider, payload.providerSessionId,
  );
  if (existing) {
    if (existing.obligation_id !== payload.obligationId) {
      throw APIError.alreadyExists("Provider session already belongs to another obligation");
    }
    return mapSession(existing);
  }
  const id = crypto.randomUUID();
  await paymentsDb.rawExec(`INSERT INTO payment_sessions
    (id,obligation_id,provider,provider_session_id,provider_reference,provider_payment_url,status,
     amount,currency,expires_at,metadata)
    VALUES ($1,$2,$3,$4,$5,$6,'open',$7::numeric,$8,$9::timestamptz,$10::jsonb)
    ON CONFLICT (provider,provider_session_id) DO NOTHING`,
  id, payload.obligationId, payload.provider, payload.providerSessionId,
  payload.providerReference ?? null, payload.providerPaymentUrl ?? null,
  obligation.settlement_amount, obligation.settlement_currency, payload.expiresAt ?? null,
  JSON.stringify(payload.metadata ?? {}));
  const created = await paymentsDb.rawQueryRow<SessionRow>(`${SESSION_SELECT} WHERE s.id=$1`, id);
  if (created) return mapSession(created);
  const raced = await paymentsDb.rawQueryRow<SessionRow>(
    `${SESSION_SELECT} WHERE s.provider=$1 AND s.provider_session_id=$2`,
    payload.provider, payload.providerSessionId,
  );
  if (!raced) throw new Error("payment_session_not_created");
  if (raced.obligation_id !== payload.obligationId) {
    throw APIError.alreadyExists("Provider session already belongs to another obligation");
  }
  return mapSession(raced);
}

export async function findPaymentSessionByProviderReference(
  provider: PaymentProviderId,
  reference: string,
): Promise<PaymentSessionResponse | null> {
  const row = await paymentsDb.rawQueryRow<SessionRow>(`${SESSION_SELECT}
    WHERE s.provider=$1 AND (s.provider_session_id=$2 OR s.provider_reference=$2)
    ORDER BY s.created_at DESC LIMIT 1`, provider, reference);
  return row ? mapSession(row) : null;
}

export async function recordPaymentProviderEvent(input: {
  provider: PaymentProviderId;
  providerEventId: string;
  paymentSessionId: string;
  payload: Record<string, unknown>;
  outcome: string;
}): Promise<void> {
  const session = await paymentsDb.rawQueryRow<{ provider: string }>(
    "SELECT provider FROM payment_sessions WHERE id=$1", input.paymentSessionId);
  if (!session || session.provider !== input.provider) {
    throw APIError.failedPrecondition("Provider event does not match the payment session");
  }
  await paymentsDb.rawExec(`INSERT INTO payment_provider_events
    (id,provider,provider_event_id,payment_session_id,payload,status)
    VALUES ($1,$2,$3,$4,$5::jsonb,'verified')
    ON CONFLICT (provider,provider_event_id) DO NOTHING`,
  crypto.randomUUID(), input.provider, input.providerEventId, input.paymentSessionId,
  JSON.stringify(input.payload));
  const event = await paymentsDb.rawQueryRow<{ payment_session_id: string }>(
    "SELECT payment_session_id FROM payment_provider_events WHERE provider=$1 AND provider_event_id=$2",
    input.provider, input.providerEventId,
  );
  if (!event || event.payment_session_id !== input.paymentSessionId) {
    throw APIError.alreadyExists("Provider event already belongs to another payment session");
  }
  const normalized = input.outcome.toLowerCase();
  const terminal = normalized.includes("cancel") ? "cancelled"
    : normalized.includes("expir") ? "expired"
      : normalized.includes("fail") || normalized.includes("declin") ? "failed"
        : null;
  if (terminal) {
    await paymentsDb.rawExec(`UPDATE payment_sessions SET status=$2,updated_at=now()
      WHERE id=$1 AND status IN ('created','open')`, input.paymentSessionId, terminal);
  }
}

export const registerSession = api<RegisterPaymentSessionRequest, PaymentSessionResponse>(
  { method: "POST", path: "/internal/payments/sessions", expose: false },
  registerPaymentSession,
);
