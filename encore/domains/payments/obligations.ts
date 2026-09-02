// Author: Klaasvaakie ( |╲ )
import { api, APIError } from "encore.dev/api";
import { z } from "zod";
import { paymentsDb } from "../../resources";
import { decimalToUnits } from "./chains/amount";

export interface CreatePaymentObligationRequest {
  subjectType: string;
  subjectReference: string;
  payerProfileId: string;
  beneficiaryProfileId: string;
  settlementCurrency: string;
  settlementAmount: string;
  metadata?: Record<string, unknown>;
}

const createObligationRequest = z.object({
  subjectType: z.string().min(1).max(100),
  subjectReference: z.string().min(1).max(200),
  payerProfileId: z.string().uuid(),
  beneficiaryProfileId: z.string().uuid(),
  settlementCurrency: z.string().min(2).max(20).transform((value) => value.toUpperCase()),
  settlementAmount: z.string().regex(/^\d+(?:\.\d{1,6})?$/),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type PaymentObligationResponse = {
  id: string;
  subjectType: string;
  subjectReference: string;
  payerProfileId: string;
  beneficiaryProfileId: string;
  settlementCurrency: string;
  settlementAmount: string;
  status: string;
};

type PaymentObligationRow = {
  id: string;
  subject_type: string;
  subject_reference: string;
  payer_profile_id: string;
  beneficiary_profile_id: string;
  settlement_currency: string;
  settlement_amount: string;
  status: string;
};

function mapObligation(row: PaymentObligationRow): PaymentObligationResponse {
  return {
    id: row.id,
    subjectType: row.subject_type,
    subjectReference: row.subject_reference,
    payerProfileId: row.payer_profile_id,
    beneficiaryProfileId: row.beneficiary_profile_id,
    settlementCurrency: row.settlement_currency,
    settlementAmount: row.settlement_amount,
    status: row.status,
  };
}

function sameStoredAmount(existing: string, incoming: string): boolean {
  return decimalToUnits(existing, 6) === decimalToUnits(incoming, 6);
}

/**
 * Internal product-domain contract. Product services decide what is owed and
 * create the obligation. Browser-facing payment APIs can only reference it.
 */
export const createPaymentObligation = api<
  CreatePaymentObligationRequest,
  PaymentObligationResponse
>(
  { method: "POST", path: "/internal/payments/obligations", expose: false },
  async (req) => {
    const payload = createObligationRequest.parse(req);
    const existing = await paymentsDb.rawQueryRow<PaymentObligationRow>(
      `SELECT id, subject_type, subject_reference, payer_profile_id, beneficiary_profile_id,
              settlement_currency, settlement_amount::text AS settlement_amount, status
         FROM payment_obligations
        WHERE subject_type = $1 AND subject_reference = $2`,
      payload.subjectType,
      payload.subjectReference,
    );
    if (existing) {
      if (
        existing.payer_profile_id !== payload.payerProfileId ||
        existing.beneficiary_profile_id !== payload.beneficiaryProfileId ||
        existing.settlement_currency !== payload.settlementCurrency ||
        !sameStoredAmount(existing.settlement_amount, payload.settlementAmount)
      ) {
        throw APIError.alreadyExists("Payment obligation subject already exists with different terms");
      }
      return mapObligation(existing);
    }

    const id = crypto.randomUUID();
    try {
      const row = await paymentsDb.rawQueryRow<PaymentObligationRow>(
        `INSERT INTO payment_obligations
          (id, subject_type, subject_reference, payer_profile_id, beneficiary_profile_id,
           settlement_currency, settlement_amount, status, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7::numeric, 'open', $8::jsonb)
         RETURNING id, subject_type, subject_reference, payer_profile_id, beneficiary_profile_id,
                   settlement_currency, settlement_amount::text AS settlement_amount, status`,
        id,
        payload.subjectType,
        payload.subjectReference,
        payload.payerProfileId,
        payload.beneficiaryProfileId,
        payload.settlementCurrency,
        payload.settlementAmount,
        JSON.stringify(payload.metadata ?? {}),
      );
      if (!row) throw new Error("payment_obligation_not_created");
      return mapObligation(row);
    } catch (error) {
      const raced = await paymentsDb.rawQueryRow<PaymentObligationRow>(
        `SELECT id, subject_type, subject_reference, payer_profile_id, beneficiary_profile_id,
                settlement_currency, settlement_amount::text AS settlement_amount, status
           FROM payment_obligations
          WHERE subject_type = $1 AND subject_reference = $2`,
        payload.subjectType,
        payload.subjectReference,
      );
      if (!raced) throw error;
      if (
        raced.payer_profile_id !== payload.payerProfileId ||
        raced.beneficiary_profile_id !== payload.beneficiaryProfileId ||
        raced.settlement_currency !== payload.settlementCurrency ||
        !sameStoredAmount(raced.settlement_amount, payload.settlementAmount)
      ) {
        throw APIError.alreadyExists("Payment obligation subject already exists with different terms");
      }
      return mapObligation(raced);
    }
  },
);

export interface CancelPaymentObligationRequest {
  obligationId: string;
  reason?: string;
}

export interface CancelPaymentObligationResponse {
  obligationId: string;
  status: "cancelled";
}

export const cancelPaymentObligation = api<
  CancelPaymentObligationRequest,
  CancelPaymentObligationResponse
>(
  { method: "POST", path: "/internal/payments/obligations/:obligationId/cancel", expose: false },
  async (req) => {
    const row = await paymentsDb.rawQueryRow<{ status: string }>(
      "SELECT status FROM payment_obligations WHERE id = $1",
      req.obligationId,
    );
    if (!row) throw APIError.notFound("Payment obligation not found");
    if (row.status !== "open") {
      throw APIError.failedPrecondition("Payment obligation with credited funds cannot be cancelled");
    }
    await paymentsDb.rawExec(
      `UPDATE payment_obligations
          SET status = 'cancelled', cancelled_at = now(), updated_at = now(),
              metadata = metadata || $2::jsonb
        WHERE id = $1 AND status = 'open'`,
      req.obligationId,
      JSON.stringify({ cancellationReason: req.reason?.trim().slice(0, 1000) ?? null }),
    );
    return { obligationId: req.obligationId, status: "cancelled" };
  },
);
