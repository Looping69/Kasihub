// Author: Klaasvaakie ( |\ )
import { api, APIError } from "encore.dev/api";
import { z } from "zod";
import { paymentsDb } from "../../resources";
import { PAYMENT_PROVIDERS, type PaymentProviderId } from "./provider-contract";
import { classifyObligationFunding, type ObligationFundingStatus } from "./settlement-policy";
import { decimalToUnits, unitsToDecimal } from "./chains/amount";

export interface RecordConfirmedPaymentCreditRequest {
  obligationId: string;
  paymentSessionId?: string;
  provider: PaymentProviderId;
  providerReference: string;
  asset: string;
  amount: string;
  observedAt: string;
  evidence?: Record<string, unknown>;
}

export type PaymentCreditResult = {
  creditId: string;
  obligationId: string;
  subjectType: string;
  subjectReference: string;
  obligationStatus: ObligationFundingStatus | "review_required";
  creditedAmount: string;
  amountDue: string;
  settlementId?: string;
};

const creditRequest = z.object({
  obligationId: z.string().uuid(), paymentSessionId: z.string().uuid().optional(),
  provider: z.enum(PAYMENT_PROVIDERS), providerReference: z.string().min(1).max(300),
  asset: z.string().min(2).max(20).transform((value) => value.toUpperCase()),
  amount: z.string().regex(/^\d+(?:\.\d{1,6})?$/), observedAt: z.iso.datetime(),
  evidence: z.record(z.string(), z.unknown()).optional(),
});

export async function recordConfirmedPaymentCredit(
  req: RecordConfirmedPaymentCreditRequest,
): Promise<PaymentCreditResult> {
  const payload = creditRequest.parse(req);
  const tx = await paymentsDb.begin();
  try {
    await tx.rawExec("SELECT pg_advisory_xact_lock(hashtext($1))", `payment-obligation:${payload.obligationId}`);
    const obligation = await tx.rawQueryRow<{
      subject_type: string; subject_reference: string; settlement_currency: string;
      settlement_amount: string; status: string;
    }>(`SELECT subject_type,subject_reference,settlement_currency,
        settlement_amount::text AS settlement_amount,status
        FROM payment_obligations WHERE id=$1 FOR UPDATE`, payload.obligationId);
    if (!obligation) throw APIError.notFound("Payment obligation not found");
    if (payload.asset !== obligation.settlement_currency) {
      throw APIError.failedPrecondition("Payment credit asset does not match the obligation");
    }
    if (payload.paymentSessionId) {
      const session = await tx.rawQueryRow<{ obligation_id: string; provider: string }>(
        "SELECT obligation_id,provider FROM payment_sessions WHERE id=$1",
        payload.paymentSessionId,
      );
      if (!session || session.obligation_id !== payload.obligationId || session.provider !== payload.provider) {
        throw APIError.failedPrecondition("Payment session does not match the credit");
      }
    }
    const creditId = crypto.randomUUID();
    await tx.rawExec(`INSERT INTO payment_credits
      (id,obligation_id,payment_session_id,provider,provider_reference,asset,amount,status,evidence,observed_at,finalized_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7::numeric,'confirmed',$8::jsonb,$9::timestamptz,now())
      ON CONFLICT (provider,provider_reference,asset) DO NOTHING`,
    creditId, payload.obligationId, payload.paymentSessionId ?? null, payload.provider,
    payload.providerReference, payload.asset, payload.amount, JSON.stringify(payload.evidence ?? {}), payload.observedAt);
    const credit = await tx.rawQueryRow<{ id: string; obligation_id: string; amount: string }>(
      `SELECT id,obligation_id,amount::text AS amount FROM payment_credits
       WHERE provider=$1 AND provider_reference=$2 AND asset=$3`,
      payload.provider, payload.providerReference, payload.asset,
    );
    if (!credit) throw new Error("payment_credit_not_recorded");
    if (credit.obligation_id !== payload.obligationId
      || decimalToUnits(credit.amount, 6) !== decimalToUnits(payload.amount, 6)) {
      throw APIError.alreadyExists("Provider credit reference was reused with different payment evidence");
    }
    const credits = await tx.rawQueryAll<{ amount: string }>(
      `SELECT amount::text AS amount FROM payment_credits
       WHERE obligation_id=$1 AND status='confirmed' ORDER BY created_at`, payload.obligationId);
    const funding = classifyObligationFunding(obligation.settlement_amount, credits.map((row) => row.amount));
    const obligationStatus = obligation.status === "cancelled" ? "review_required" : funding.status;
    await tx.rawExec("UPDATE payment_obligations SET status=$2,updated_at=now() WHERE id=$1",
      payload.obligationId, obligationStatus);
    if (payload.paymentSessionId) {
      await tx.rawExec("UPDATE payment_sessions SET status='completed',updated_at=now() WHERE id=$1",
        payload.paymentSessionId);
    }
    let settlementId: string | undefined;
    if (obligationStatus === "paid") {
      settlementId = crypto.randomUUID();
      await tx.rawExec(`INSERT INTO payment_settlements (id,obligation_id,currency,amount,status)
        VALUES ($1,$2,$3,$4::numeric,'settled') ON CONFLICT (obligation_id) DO NOTHING`,
      settlementId, payload.obligationId, obligation.settlement_currency, obligation.settlement_amount);
      const settlement = await tx.rawQueryRow<{ id: string }>(
        "SELECT id FROM payment_settlements WHERE obligation_id=$1", payload.obligationId);
      if (!settlement) throw new Error("payment_settlement_not_created");
      settlementId = settlement.id;
      await tx.rawExec(`UPDATE payment_obligations SET settled_at=COALESCE(settled_at,now()) WHERE id=$1`, payload.obligationId);
      await tx.rawExec(`INSERT INTO payment_outbox
        (id,event_key,event_type,schema_version,aggregate_type,aggregate_id,payload)
        VALUES ($1,$2,'payment_obligation.settled','payment-obligation-settled.v1','payment_obligation',$3,$4::jsonb)
        ON CONFLICT (event_key) DO NOTHING`, crypto.randomUUID(),
      `payment-obligation:${payload.obligationId}:settled`, payload.obligationId,
      JSON.stringify({ obligationId: payload.obligationId, subjectType: obligation.subject_type,
        subjectReference: obligation.subject_reference, settlementId }));
    }
    await tx.commit();
    return {
      creditId: credit.id, obligationId: payload.obligationId,
      subjectType: obligation.subject_type, subjectReference: obligation.subject_reference,
      obligationStatus, creditedAmount: unitsToDecimal(funding.creditedUnits, 6),
      amountDue: unitsToDecimal(funding.dueUnits, 6),
      ...(settlementId ? { settlementId } : {}),
    };
  } catch (error) {
    try { await tx.rollback(); } catch { /* transaction may already be closed */ }
    throw error;
  }
}

export const recordCredit = api<RecordConfirmedPaymentCreditRequest, PaymentCreditResult>(
  { method: "POST", path: "/internal/payments/credits", expose: false },
  recordConfirmedPaymentCredit,
);
