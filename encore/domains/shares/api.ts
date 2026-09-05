// Author: Klaasvaakie ( |╲ )
import { api, APIError } from "encore.dev/api";
import { StructKeyspace, expireInSeconds } from "encore.dev/storage/cache";
import { z } from "zod";
import { applicationCache, auditDb, documentsBucket, financeDb, identityDb, presaleDb, sharesDb } from "../../resources";
import { requireAdminAccess, requireEcosystemProfileAccess, requireProfileAccess, requireSession } from "../auth/access";
import {
  beginOperation,
  captureWalletHold,
  completeOperation,
  failOperation,
  placeWalletHold,
  recordStep,
  requireIdempotencyKey,
} from "../workflows/core";
import { cacheDelete, cacheRead, cacheWrite } from "../shared/cache";
import { certificatePayloadHash } from "./certificate-integrity";

interface SharePurchaseRequest {
  profileId: string;
  phaseNumber: number;
  quantity: number;
}

interface SharePhaseResponse {
  id: string;
  phaseNumber: number;
  quantityAvailable: number;
  pricePerShare: string;
  currency: string;
  status: string;
  totalShares: number;
  bonusBuyOneGet: boolean;
  createdAt: string;
  updatedAt: string;
}

interface SharePurchaseResponse {
  purchaseId: string;
  status: string;
  totalAmount: string;
  bonusQuantity: number;
  certificateNumber: string;
  operationId: string;
}

const sharePhaseCache = new StructKeyspace<string, { phases: SharePhaseResponse[] }>(applicationCache, {
  keyPattern: "share-phases/:key",
  defaultExpiry: expireInSeconds(15),
});

const sharePurchaseRequest = z.object({
  profileId: z.string().min(1),
  phaseNumber: z.number().int().positive(),
  quantity: z.number().int().positive(),
});

export const myShares = api<
  { profileId: string },
  { certificates: { certificateNumber: string; totalShares: number; status: string; issuedAt: string; revokedAt: string | null;
    phaseNumber?: number; distinctiveFrom?: number; distinctiveTo?: number; paidShares?: number; bonusShares?: number; complimentaryShares?: number;
    purchaseTotalAmount?: number; source?: string;
    issuePricePerShare?: number; issuePriceCurrency?: string; verificationId?: string;
    holderNameSnapshot?: string; holderAddressSnapshot?: string; profileNumberSnapshot?: string;
    integrityPayload?: string; integrityHash?: string }[] }
>(
  { method: "GET", path: "/shares/me/:profileId", expose: true },
  async (req) => {
    await requireProfileAccess(req.profileId);
    const rows = await sharesDb.rawQueryAll<{
      certificate_number: string;
      total_shares: number;
      status: string;
      issued_at: string;
      revoked_at: string | null;
      phase_number: number | null;
      distinctive_from: number | null;
      distinctive_to: number | null;
      complimentary_shares: number;
      paid_shares: number | null;
      bonus_shares: number | null;
      issue_price_per_share: string | null;
      issue_price_currency: string | null;
      purchase_total_amount: string | null;
      source: string;
      verification_id: string | null;
      holder_name_snapshot: string | null;
      holder_address_snapshot: string | null;
      profile_number_snapshot: string | null;
      certificate_payload: string | null;
      certificate_payload_sha256: string | null;
    }>(`SELECT certificate_number, certificate.total_shares, certificate.status, certificate.issued_at, certificate.revoked_at,
              COALESCE(certificate.phase_number, phase.phase_number) AS phase_number,
              distinctive_from, distinctive_to, paid_shares, bonus_shares, complimentary_shares,
              COALESCE(certificate.issue_price_per_share_snapshot,
                CASE WHEN sp.quantity > 0 THEN sp.total_amount / sp.quantity ELSE NULL END)::text AS issue_price_per_share,
              COALESCE(certificate.issue_price_currency_snapshot, phase.currency) AS issue_price_currency,
              sp.total_amount::text AS purchase_total_amount, certificate.source,
              verification_id,holder_name_snapshot,holder_address_snapshot,profile_number_snapshot,
              certificate_payload,certificate_payload_sha256
         FROM share_certificates certificate
         LEFT JOIN share_purchases sp ON sp.certificate_id = certificate.id
           OR (sp.certificate_id IS NULL AND sp.presale_order_reference = certificate.presale_order_reference)
         LEFT JOIN share_phases phase ON phase.id = sp.phase_id
         WHERE certificate.profile_id = $1 ORDER BY certificate.issued_at DESC`,
      req.profileId,
    );
    return {
      certificates: rows.map((row) => ({
        certificateNumber: row.certificate_number,
        totalShares: row.total_shares,
        status: row.status,
        issuedAt: row.issued_at,
        revokedAt: row.revoked_at,
        phaseNumber: row.phase_number ?? undefined,
        distinctiveFrom: row.distinctive_from ?? undefined,
        distinctiveTo: row.distinctive_to ?? undefined,
        complimentaryShares: row.complimentary_shares ?? 0,
        paidShares: row.paid_shares ?? undefined,
        bonusShares: row.bonus_shares ?? undefined,
        purchaseTotalAmount: row.purchase_total_amount === null ? undefined : Number(row.purchase_total_amount),
        source: row.source,
        issuePricePerShare: row.issue_price_per_share === null ? undefined : Number(row.issue_price_per_share),
        issuePriceCurrency: row.issue_price_currency ?? undefined,
        verificationId: row.verification_id ?? undefined,
        holderNameSnapshot: row.holder_name_snapshot ?? undefined,
        holderAddressSnapshot: row.holder_address_snapshot ?? undefined,
        profileNumberSnapshot: row.profile_number_snapshot ?? undefined,
        integrityPayload: row.certificate_payload ?? undefined,
        integrityHash: row.certificate_payload_sha256 ?? undefined,
      })),
    };
  },
);

type ShareholderPortfolioV2 = {
  schemaVersion: "shareholder-portfolio.v2";
  asOf: string;
  ledgerRevision: string;
  summary: {
    issuedShares: number;
    paidShares: number;
    bonusShares: number;
    complimentaryShares: number;
    acquisitionCost: { amount: string; currency: "USD" };
  };
  holdings: Array<{
    orderReference: string | null;
    certificateNumber: string;
    certificateStatus: string;
    issuedAt: string;
    revokedAt: string | null;
    phaseNumber: number | null;
    paidShares: number;
    bonusShares: number;
    complimentaryShares: number;
    totalShares: number;
    distinctiveFrom: number | null;
    distinctiveTo: number | null;
    acquisitionCost: { amount: string; currency: string };
    issuePricePerPaidShare: { amount: string; currency: string } | null;
    verificationId: string | null;
  }>;
  capabilities: { canApplyForMoreShares: boolean; applicationUrl: "/presale" };
};

export const myShareholderPortfolio = api<void, ShareholderPortfolioV2>(
  { method: "GET", path: "/shares/portfolio/me", expose: true },
  async () => {
    const session = await requireSession();
    await requireEcosystemProfileAccess(session.profile.id);
    const [rows, summary, revision] = await Promise.all([
      sharesDb.rawQueryAll<{
        presale_order_reference: string | null; certificate_number: string; status: string; issued_at: string;
        revoked_at: string | null; phase_number: number | null; paid_shares: number | null; bonus_shares: number | null;
        complimentary_shares: number; total_shares: number; distinctive_from: number | null; distinctive_to: number | null; total_amount: string | null;
        currency: string | null; issue_price_per_paid_share: string | null; verification_id: string | null;
      }>(`SELECT certificate.presale_order_reference,certificate.certificate_number,certificate.status,
                certificate.issued_at,certificate.revoked_at,COALESCE(certificate.phase_number,phase.phase_number) AS phase_number,
                COALESCE(certificate.paid_shares,purchase.quantity,certificate.total_shares) AS paid_shares,
                COALESCE(certificate.bonus_shares,purchase.bonus_quantity,0) AS bonus_shares,
                certificate.complimentary_shares,certificate.total_shares,certificate.distinctive_from,certificate.distinctive_to,
                COALESCE(purchase.total_amount,0)::text AS total_amount,COALESCE(phase.currency,'USD') AS currency,
                CASE WHEN COALESCE(certificate.paid_shares,purchase.quantity,0)>0
                  THEN (COALESCE(purchase.total_amount,0)/COALESCE(certificate.paid_shares,purchase.quantity))::text
                  ELSE NULL END AS issue_price_per_paid_share,
                certificate.verification_id
           FROM share_certificates certificate
           LEFT JOIN share_purchases purchase ON purchase.certificate_id=certificate.id
             OR (purchase.certificate_id IS NULL AND purchase.presale_order_reference=certificate.presale_order_reference)
           LEFT JOIN share_phases phase ON phase.id=purchase.phase_id
          WHERE certificate.profile_id=$1
          ORDER BY certificate.issued_at DESC,certificate.certificate_number`, session.profile.id),
      sharesDb.rawQueryRow<{
        complimentary_shares: string; issued_shares: string; paid_shares: string; bonus_shares: string; acquisition_cost: string;
      }>(`SELECT COALESCE(SUM(certificate.complimentary_shares) FILTER (WHERE certificate.status='issued'),0)::text AS complimentary_shares, COALESCE(SUM(certificate.total_shares) FILTER (WHERE certificate.status='issued'),0)::text AS issued_shares,
                COALESCE(SUM(COALESCE(certificate.paid_shares,purchase.quantity,certificate.total_shares))
                  FILTER (WHERE certificate.status='issued'),0)::text AS paid_shares,
                COALESCE(SUM(COALESCE(certificate.bonus_shares,purchase.bonus_quantity,0))
                  FILTER (WHERE certificate.status='issued'),0)::text AS bonus_shares,
                COALESCE(SUM(COALESCE(purchase.total_amount,0)) FILTER (WHERE certificate.status='issued'),0)::text AS acquisition_cost
           FROM share_certificates certificate
           LEFT JOIN share_purchases purchase ON purchase.certificate_id=certificate.id
             OR (purchase.certificate_id IS NULL AND purchase.presale_order_reference=certificate.presale_order_reference)
          WHERE certificate.profile_id=$1`, session.profile.id),
      sharesDb.rawQueryRow<{ revision: string }>(`SELECT CONCAT(COUNT(*)::text,':',COALESCE(MAX(completed_at)::text,'empty')) AS revision
        FROM share_issuance_operations WHERE purchase_id IN
          (SELECT id FROM share_purchases WHERE profile_id=$1)`, session.profile.id),
    ]);
    return {
      schemaVersion: "shareholder-portfolio.v2",
      asOf: new Date().toISOString(),
      ledgerRevision: revision?.revision ?? "0:empty",
      summary: {
        issuedShares: Number(summary?.issued_shares ?? "0"),
        paidShares: Number(summary?.paid_shares ?? "0"),
        bonusShares: Number(summary?.bonus_shares ?? "0"),
        complimentaryShares: Number(summary?.complimentary_shares ?? "0"),
        acquisitionCost: { amount: summary?.acquisition_cost ?? "0", currency: "USD" },
      },
      holdings: rows.map((row) => ({
        orderReference: row.presale_order_reference,
        certificateNumber: row.certificate_number,
        certificateStatus: row.status,
        issuedAt: row.issued_at,
        revokedAt: row.revoked_at,
        phaseNumber: row.phase_number,
        complimentaryShares: row.complimentary_shares ?? 0,
        paidShares: row.paid_shares ?? row.total_shares,
        bonusShares: row.bonus_shares ?? 0,
        totalShares: row.total_shares,
        distinctiveFrom: row.distinctive_from,
        distinctiveTo: row.distinctive_to,
        acquisitionCost: { amount: row.total_amount ?? "0", currency: row.currency ?? "USD" },
        issuePricePerPaidShare: row.issue_price_per_paid_share === null ? null
          : { amount: row.issue_price_per_paid_share, currency: row.currency ?? "USD" },
        verificationId: row.verification_id,
      })),
      capabilities: { canApplyForMoreShares: true, applicationUrl: "/presale" },
    };
  },
);

export const revokeShareCertificate = api<
  { certificateNumber: string },
  { ok: true }
>(
  { method: "POST", path: "/admin/shares/certificates/:certificateNumber/revoke", expose: true },
  async (req) => {
    await requireAdminAccess();
    await sharesDb.rawExec(`UPDATE share_certificates SET status = 'revoked', revoked_at = now() WHERE certificate_number = $1`,
      req.certificateNumber,
    );
    await auditDb.rawExec(`INSERT INTO audit_logs (action, entity_type, entity_id, after)
       VALUES ($1, $2, gen_random_uuid(), $3::jsonb)`,
      "shares.certificate.revoke",
      "share_certificates",
      JSON.stringify({ certificateNumber: req.certificateNumber }),
    );
    return { ok: true };
  },
);

export const reissueShareCertificate = api<
  { profileId: string },
  { certificateNumber: string; status: string }
>(
  { method: "POST", path: "/admin/shares/certificates/reissue", expose: true },
  async (req) => {
    await requireAdminAccess();
    const previous = await sharesDb.rawQueryRow<{ certificate_number: string }>("SELECT certificate_number FROM share_certificates WHERE profile_id = $1 ORDER BY issued_at DESC LIMIT 1",
      req.profileId,
    );
    if (previous) {
      await sharesDb.rawExec(`UPDATE share_certificates SET status = 'revoked', revoked_at = now() WHERE certificate_number = $1`,
        previous.certificate_number,
      );
    }
    const total = await sharesDb.rawQueryRow<{ total: string }>("SELECT COALESCE(SUM(total_shares), 0)::text AS total FROM share_certificates WHERE profile_id = $1 AND status <> 'revoked'",
      req.profileId,
    );
    const certificateNumber = `CERT-${String(Date.now()).slice(-10)}`;
    await sharesDb.rawExec(`INSERT INTO share_certificates (profile_id, certificate_number, total_shares, status, issued_at)
       VALUES ($1, $2, $3::int, 'issued', now())`,
      req.profileId,
      certificateNumber,
      Number(total?.total ?? "0"),
    );
    await auditDb.rawExec(`INSERT INTO audit_logs (action, entity_type, entity_id, after)
       VALUES ($1, $2, gen_random_uuid(), $3::jsonb)`,
      "shares.certificate.reissue",
      "share_certificates",
      JSON.stringify({ profileId: req.profileId, certificateNumber }),
    );
    return { certificateNumber, status: "issued" };
  },
);

export const listSharePhases = api<
  void,
  { phases: SharePhaseResponse[] }
>(
  { method: "GET", path: "/shares/phases", expose: true },
  async () => {
    const cached = await cacheRead(sharePhaseCache, "all-v2");
    if (cached) return cached;
    const rows = await sharesDb.rawQueryAll<{
      id: string;
      phase_number: number;
      quantity_available: number;
      price_per_share: string;
      currency: string;
      status: string;
      total_quantity: number;
      bonus_buy_one_get: boolean;
      created_at: string;
      updated_at: string;
    }>(`SELECT id, phase_number, quantity_available, price_per_share::text AS price_per_share, currency, status,
              total_quantity, bonus_buy_one_get, created_at, updated_at
         FROM share_phases ORDER BY phase_number`);
    if (rows.length === 0) {
      await sharesDb.rawExec(`INSERT INTO share_phases
           (phase_number, quantity_available, total_quantity, price_per_share, currency, status, bonus_buy_one_get, starts_at)
         VALUES (1, 100000, 100000, 25.00, 'USD', 'active', true, now())
         ON CONFLICT (phase_number) DO UPDATE SET
           quantity_available = EXCLUDED.quantity_available,
           total_quantity = EXCLUDED.total_quantity,
           price_per_share = EXCLUDED.price_per_share,
           currency = EXCLUDED.currency,
           status = EXCLUDED.status,
           bonus_buy_one_get = EXCLUDED.bonus_buy_one_get`,
      );
      const seeded = await sharesDb.rawQueryAll<{
        id: string;
        phase_number: number;
        quantity_available: number;
        price_per_share: string;
        currency: string;
        status: string;
        total_quantity: number;
        bonus_buy_one_get: boolean;
        created_at: string;
        updated_at: string;
      }>(`SELECT id, phase_number, quantity_available, price_per_share::text AS price_per_share, currency, status,
                total_quantity, bonus_buy_one_get, created_at, updated_at
           FROM share_phases ORDER BY phase_number`);
      const response = {
        phases: seeded.map((row) => ({
          id: row.id,
          phaseNumber: row.phase_number,
          quantityAvailable: row.quantity_available,
          pricePerShare: row.price_per_share,
          currency: row.currency,
          status: row.status,
          totalShares: row.total_quantity,
          bonusBuyOneGet: row.bonus_buy_one_get,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        })),
      };
      await cacheWrite(sharePhaseCache, "all-v2", response);
      return response;
    }
    const response = {
      phases: rows.map((row) => ({
        id: row.id,
        phaseNumber: row.phase_number,
        quantityAvailable: row.quantity_available,
        pricePerShare: row.price_per_share,
        currency: row.currency,
        status: row.status,
        totalShares: row.total_quantity,
        bonusBuyOneGet: row.bonus_buy_one_get,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
    };
    await cacheWrite(sharePhaseCache, "all-v2", response);
    return response;
  },
);

const DIRECT_SHARE_PURCHASES_ENABLED = false;

export const purchaseShares = api<SharePurchaseRequest, SharePurchaseResponse>(
  { method: "POST", path: "/shares/purchase", expose: true },
  async (req) => {
    // New share issuance must pass through the invitation, KYC, payment
    // verification and incorporation workflow. Keep the legacy endpoint
    // fail-closed while historical wallet purchases remain readable.
    if (!DIRECT_SHARE_PURCHASES_ENABLED) {
      throw APIError.failedPrecondition("Direct share purchases are disabled; use the private presale application");
    }

    const payload = sharePurchaseRequest.parse(req);
    const session = await requireProfileAccess(payload.profileId);
    const idempotencyKey = requireIdempotencyKey();
    const started = await beginOperation<SharePurchaseResponse>({
      operationType: "share_purchase",
      actorUserId: session.user.id,
      profileId: payload.profileId,
      idempotencyKey,
      payload,
    });
    if (started.operation.state === "completed" && started.operation.result) return started.operation.result;

    const operation = started.operation;
    let reservationCreated = false;
    try {
      let purchase = await sharesDb.rawQueryRow<{
        id: string; phase_id: string; quantity: number; bonus_quantity: number; total_amount: string; status: string; certificate_id: string | null;
      }>(`SELECT id, phase_id, quantity, bonus_quantity, total_amount::text AS total_amount, status, certificate_id
          FROM share_purchases WHERE operation_id = $1`, operation.id);

      if (!purchase) {
        const tx = await sharesDb.begin();
        try {
          const phase = await tx.rawQueryRow<{ id: string; price_per_share: string; currency: string; bonus_buy_one_get: boolean }>(
            `UPDATE share_phases
             SET quantity_available = quantity_available - CASE WHEN bonus_buy_one_get THEN $2 * 2 ELSE $2 END,
                 updated_at = now()
             WHERE phase_number = $1 AND status = 'active'
               AND quantity_available >= CASE WHEN bonus_buy_one_get THEN $2 * 2 ELSE $2 END
             RETURNING id, price_per_share::text AS price_per_share, currency, bonus_buy_one_get`,
            payload.phaseNumber, payload.quantity,
          );
          if (!phase) throw APIError.failedPrecondition("Share phase is closed or does not have enough inventory");
          const bonusQuantity = phase.bonus_buy_one_get ? payload.quantity : 0;
          const totalAmount = (Number(phase.price_per_share) * payload.quantity).toFixed(2);
          const purchaseId = crypto.randomUUID();
          await tx.rawExec(`INSERT INTO share_purchases
             (id, profile_id, phase_id, quantity, bonus_quantity, total_amount, status, operation_id, created_at)
             VALUES ($1, $2, $3, $4, $5, $6::numeric, 'reserved', $7, now())`,
            purchaseId, payload.profileId, phase.id, payload.quantity, bonusQuantity, totalAmount, operation.id);
          await tx.commit();
          reservationCreated = true;
          purchase = { id: purchaseId, phase_id: phase.id, quantity: payload.quantity, bonus_quantity: bonusQuantity, total_amount: totalAmount, status: "reserved", certificate_id: null };
          await recordStep(operation, "reserve_inventory", "completed", {
            purchaseId,
            phaseNumber: payload.phaseNumber,
            purchasedQuantity: payload.quantity,
            bonusQuantity,
            reservedQuantity: payload.quantity + bonusQuantity,
          });
        } catch (error) { await tx.rollback(); throw error; }
      } else if (purchase.status === "failed") {
        const tx = await sharesDb.begin();
        try {
          const restored = await tx.rawQueryRow<{ id: string }>(`UPDATE share_phases
            SET quantity_available = quantity_available - $2, updated_at = now()
            WHERE id = $1 AND status = 'active' AND quantity_available >= $2 RETURNING id`,
            purchase.phase_id, purchase.quantity + purchase.bonus_quantity);
          if (!restored) throw APIError.failedPrecondition("Share phase is closed or does not have enough inventory");
          await tx.rawExec("UPDATE share_purchases SET status = 'reserved' WHERE id = $1", purchase.id);
          await tx.commit();
          purchase.status = "reserved";
          reservationCreated = true;
          await recordStep(operation, "reserve_inventory", "completed", {
            purchaseId: purchase.id,
            restored: true,
            purchasedQuantity: purchase.quantity,
            bonusQuantity: purchase.bonus_quantity,
            reservedQuantity: purchase.quantity + purchase.bonus_quantity,
          });
        } catch (error) { await tx.rollback(); throw error; }
      }

      const phaseCurrency = await sharesDb.rawQueryRow<{ currency: string }>("SELECT currency FROM share_phases WHERE id = $1", purchase.phase_id);
      if (!phaseCurrency) throw new Error("share_phase_not_found");
      await placeWalletHold(operation, payload.profileId, phaseCurrency.currency, purchase.total_amount);
      await recordStep(operation, "hold_wallet_funds", "completed", { amount: purchase.total_amount, currency: phaseCurrency.currency });

      await captureWalletHold(operation, "share_revenue", "Wallet-funded share purchase");
      await recordStep(operation, "capture_wallet_funds", "completed", { amount: purchase.total_amount, currency: phaseCurrency.currency });

      let certificate = purchase.certificate_id
        ? await sharesDb.rawQueryRow<{ id: string; certificate_number: string }>("SELECT id, certificate_number FROM share_certificates WHERE id = $1", purchase.certificate_id)
        : null;
      if (!certificate) {
        const tx = await sharesDb.begin();
        try {
          const locked = await tx.rawQueryRow<{ certificate_id: string | null; status: string }>(
            "SELECT certificate_id, status FROM share_purchases WHERE id = $1 FOR UPDATE", purchase.id);
          if (!locked) throw new Error("share_purchase_not_found");
          if (locked.certificate_id) {
            certificate = await tx.rawQueryRow<{ id: string; certificate_number: string }>(
              "SELECT id, certificate_number FROM share_certificates WHERE id = $1", locked.certificate_id);
          } else {
            const certificateId = crypto.randomUUID();
            const certificateNumber = `CERT-${crypto.randomUUID().toUpperCase()}`;
            await tx.rawExec(`INSERT INTO share_certificates (id, profile_id, certificate_number, total_shares, status, issued_at)
               VALUES ($1, $2, $3, $4, 'issued', now())`,
              certificateId, payload.profileId, certificateNumber, purchase.quantity + purchase.bonus_quantity);
            await tx.rawExec("UPDATE share_purchases SET certificate_id = $2, status = 'paid' WHERE id = $1", purchase.id, certificateId);
            certificate = { id: certificateId, certificate_number: certificateNumber };
          }
          await tx.commit();
        } catch (error) { await tx.rollback(); throw error; }
      }
      if (!certificate) throw new Error("share_certificate_not_created");
      await recordStep(operation, "issue_certificate", "completed", { purchaseId: purchase.id, certificateNumber: certificate.certificate_number });

      const priorAudit = await auditDb.rawQueryRow<{ id: string }>(
        "SELECT id FROM audit_logs WHERE action = 'shares.purchase' AND entity_id = $1 LIMIT 1", purchase.id);
      if (!priorAudit) {
        await auditDb.rawExec(`INSERT INTO audit_logs (action, entity_type, entity_id, actor_user_id, after)
           VALUES ('shares.purchase', 'share_purchases', $1, $2, $3::jsonb)`,
          purchase.id, session.user.id, JSON.stringify({ operationId: operation.id, profileId: payload.profileId, phaseNumber: payload.phaseNumber, quantity: purchase.quantity, bonusQuantity: purchase.bonus_quantity, totalAmount: purchase.total_amount }));
      }
      await recordStep(operation, "audit", "completed", { purchaseId: purchase.id });

      const result: SharePurchaseResponse = {
        operationId: operation.id,
        purchaseId: purchase.id,
        status: "completed",
        totalAmount: purchase.total_amount,
        bonusQuantity: purchase.bonus_quantity,
        certificateNumber: certificate.certificate_number,
      };
      await cacheDelete(sharePhaseCache, "all-v2");
      return await completeOperation(operation, result);
    } catch (error) {
      let compensationRequired = false;
      if (reservationCreated) {
        const hold = await financeDb.rawQueryRow<{ state: string }>("SELECT state FROM wallet_holds WHERE operation_id = $1", operation.id);
        if (!hold) {
          const tx = await sharesDb.begin();
          try {
            const reservation = await tx.rawQueryRow<{ phase_id: string; quantity: number; bonus_quantity: number; status: string }>(
              "SELECT phase_id, quantity, bonus_quantity, status FROM share_purchases WHERE operation_id = $1 FOR UPDATE", operation.id);
            if (reservation?.status === "reserved") {
              await tx.rawExec(
                "UPDATE share_phases SET quantity_available = quantity_available + $2, updated_at = now() WHERE id = $1",
                reservation.phase_id,
                reservation.quantity + reservation.bonus_quantity,
              );
              await tx.rawExec("UPDATE share_purchases SET status = 'failed' WHERE operation_id = $1", operation.id);
            }
            await tx.commit();
          } catch (compensationError) {
            compensationRequired = true;
            await tx.rollback();
            await recordStep(operation, "release_inventory", "failed", {}, compensationError);
          }
        } else {
          compensationRequired = true;
        }
      }
      return failOperation(operation, error, compensationRequired);
    }
  },
);

export const verifyShareCertificate = api<
  { verificationId: string },
  { verified: true; certificateNumber: string; status: string; issuedAt: string; revokedAt: string | null;
    totalShares: number; phaseNumber: number | null; distinctiveFrom: number | null; distinctiveTo: number | null;
    integrityHash: string }
>(
  { method: "GET", path: "/shares/certificates/verify/:verificationId", expose: true, auth: false },
  async (req) => {
    const verificationId = z.string().uuid().parse(req.verificationId);
    const row = await sharesDb.rawQueryRow<{
      certificate_number: string; status: string; issued_at: string; revoked_at: string | null; total_shares: number;
      phase_number: number | null; distinctive_from: number | null; distinctive_to: number | null;
      certificate_payload: string; certificate_payload_sha256: string;
    }>(`SELECT certificate_number,status,issued_at,revoked_at,total_shares,phase_number,distinctive_from,distinctive_to,
              certificate_payload,certificate_payload_sha256
         FROM share_certificates WHERE verification_id=$1`, verificationId);
    if (!row) throw APIError.notFound("Certificate verification reference not found");
    if (certificatePayloadHash(row.certificate_payload) !== row.certificate_payload_sha256) {
      throw APIError.failedPrecondition("Certificate integrity verification failed");
    }
    const payload = JSON.parse(row.certificate_payload) as Record<string, unknown>;
    if (payload.certificateNumber !== row.certificate_number || payload.totalShares !== row.total_shares
      || payload.phaseNumber !== row.phase_number || payload.distinctiveFrom !== row.distinctive_from
      || payload.distinctiveTo !== row.distinctive_to
      || typeof payload.issuedAt !== "string"
      || new Date(payload.issuedAt).getTime() !== new Date(row.issued_at).getTime()) {
      throw APIError.failedPrecondition("Certificate ledger verification failed");
    }
    return {
      verified: true, certificateNumber: row.certificate_number, status: row.status, issuedAt: row.issued_at,
      revokedAt: row.revoked_at, totalShares: row.total_shares, phaseNumber: row.phase_number,
      distinctiveFrom: row.distinctive_from, distinctiveTo: row.distinctive_to, integrityHash: row.certificate_payload_sha256,
    };
  },
);

export const updateSharePhase = api<
  { phaseId: string; pricePerShare?: number; totalShares?: number; status?: string; bonusBuyOneGet?: boolean },
  { phase: SharePhaseResponse }
>(
  { method: "PATCH", path: "/admin/shares/phases/:phaseId", expose: true },
  async (req) => {
    await requireAdminAccess();
    const existing = await sharesDb.rawQueryRow<{ total_quantity: number; quantity_available: number }>(
      "SELECT total_quantity, quantity_available FROM share_phases WHERE id = $1",
      req.phaseId,
    );
    if (!existing) throw new Error("phase_not_found");
    const sold = existing.total_quantity - existing.quantity_available;
    if (req.totalShares !== undefined && req.totalShares < sold) throw new Error("total_below_sold");
    const row = await sharesDb.rawQueryRow<{
      id: string; phase_number: number; quantity_available: number; total_quantity: number; price_per_share: string;
      currency: string; status: string; bonus_buy_one_get: boolean; created_at: string; updated_at: string;
    }>(
      `UPDATE share_phases SET
         price_per_share = COALESCE($2::numeric, price_per_share),
         total_quantity = COALESCE($3, total_quantity),
         quantity_available = CASE WHEN $3::int IS NULL THEN quantity_available ELSE $3::int - $6::int END,
         status = COALESCE($4, status), bonus_buy_one_get = COALESCE($5, bonus_buy_one_get), updated_at = now()
       WHERE id = $1
       RETURNING id, phase_number, quantity_available, total_quantity, price_per_share::text AS price_per_share,
                 currency, status, bonus_buy_one_get, created_at, updated_at`,
      req.phaseId,
      req.pricePerShare?.toFixed(2) ?? null,
      req.totalShares ?? null,
      req.status ? req.status.toLowerCase().replace("open", "active") : null,
      req.bonusBuyOneGet ?? null,
      sold,
    );
    if (!row) throw new Error("phase_not_found");
    await cacheDelete(sharePhaseCache, "all-v2");
    return { phase: { id: row.id, phaseNumber: row.phase_number, quantityAvailable: row.quantity_available, totalShares: row.total_quantity, pricePerShare: row.price_per_share, currency: row.currency, status: row.status, bonusBuyOneGet: row.bonus_buy_one_get, createdAt: row.created_at, updatedAt: row.updated_at } };
  },
);

export const adminShareCertificates = api<
  { limit?: number },
  {
    shares: {
      id: string; profileId: string; profileNumber: string; holderName: string; email: string; country: string;
      phase: number; pricePerShare: number; quantity: number; purchasedQuantity: number; bonusQuantity: number; complimentaryQuantity: number;
      totalAmount: number; currency: string; certificateNo: string; status: string; createdAt: string;
      revokedAt: string | null; source: string; orderReference: string | null; campaignName: string | null;
    }[];
    summary: { registerEntries: number; shareholderCount: number; certificateCount: number; issuedShares: number; revokedShares: number };
  }
>(
  { method: "GET", path: "/admin/shares", expose: true },
  async (req) => {
    await requireAdminAccess();
    const rows = await sharesDb.rawQueryAll<{
      id: string; profile_id: string; phase_number: number; price_per_share: string; total_shares: number;
      purchased_quantity: number; bonus_quantity: number; complimentary_quantity: number; total_amount: string; currency: string;
      certificate_number: string; status: string; issued_at: string; revoked_at: string | null;
      source: string; presale_order_reference: string | null;
    }>(
      `SELECT c.id, c.profile_id, COALESCE(p.phase_number, 1) AS phase_number,
              CASE WHEN c.complimentary_shares > 0 THEN '0' ELSE COALESCE(p.price_per_share, 0)::text END AS price_per_share, c.total_shares,
              COALESCE(sp.quantity, c.total_shares) AS purchased_quantity,
              COALESCE(sp.bonus_quantity, 0) AS bonus_quantity,c.complimentary_shares AS complimentary_quantity,
              COALESCE(sp.total_amount, 0)::text AS total_amount, COALESCE(p.currency, 'USD') AS currency,
              c.certificate_number, c.status, c.issued_at, c.revoked_at, c.source, c.presale_order_reference
       FROM share_certificates c
       LEFT JOIN share_purchases sp ON sp.certificate_id = c.id
         OR (sp.certificate_id IS NULL AND sp.presale_order_reference = c.presale_order_reference)
       LEFT JOIN share_phases p ON p.id = sp.phase_id
       ORDER BY c.issued_at DESC LIMIT $1`,
      Math.min(Math.max(req.limit ?? 50, 1), 500),
    );
    const ledgerSummary = await sharesDb.rawQueryRow<{
      register_entries: string; shareholder_count: string; certificate_count: string;
      issued_shares: string; revoked_shares: string;
    }>(`SELECT COUNT(*)::text AS register_entries,
              (COUNT(DISTINCT profile_id) FILTER (WHERE status='issued'))::text AS shareholder_count,
              (COUNT(*) FILTER (WHERE status='issued'))::text AS certificate_count,
              COALESCE(SUM(total_shares) FILTER (WHERE status='issued'),0)::text AS issued_shares,
              COALESCE(SUM(total_shares) FILTER (WHERE status='revoked'),0)::text AS revoked_shares
       FROM share_certificates`);
    const profileIds = [...new Set(rows.map((row) => row.profile_id))];
    const orderReferences = [...new Set(rows.flatMap((row) => row.presale_order_reference ? [row.presale_order_reference] : []))];
    const [holders, campaigns] = await Promise.all([
      profileIds.length === 0 ? [] : identityDb.rawQueryAll<{
        id: string; profile_number: string; first_name: string | null; surname: string | null;
        company_name: string | null; email: string; country: string | null;
      }>(`SELECT p.id,p.unique_profile_number AS profile_number,p.first_name,p.surname,p.company_name,u.email,p.country
          FROM profiles p JOIN users u ON u.id=p.user_id WHERE p.id=ANY($1::uuid[])`, profileIds),
      orderReferences.length === 0 ? [] : presaleDb.rawQueryAll<{
        order_reference: string; campaign_name: string;
      }>(`SELECT o.order_reference,c.name AS campaign_name FROM presale_orders o
          JOIN presale_campaigns c ON c.id=o.campaign_id WHERE o.order_reference=ANY($1::text[])`, orderReferences),
    ]);
    const holderByProfile = new Map(holders.map((holder) => [holder.id, holder]));
    const campaignByOrder = new Map(campaigns.map((campaign) => [campaign.order_reference, campaign.campaign_name]));
    const shares = rows.map((row) => {
      const holder = holderByProfile.get(row.profile_id);
      const holderName = holder?.company_name
        ?? ([holder?.first_name, holder?.surname].filter(Boolean).join(" ")
          || holder?.email
          || holder?.profile_number
          || row.profile_id);
      return {
        id: row.id, profileId: row.profile_id, profileNumber: holder?.profile_number ?? row.profile_id,
        holderName, email: holder?.email ?? "", country: holder?.country ?? "",
        phase: row.phase_number, pricePerShare: Number(row.price_per_share), quantity: row.total_shares,
        purchasedQuantity: row.purchased_quantity, bonusQuantity: row.bonus_quantity, complimentaryQuantity: row.complimentary_quantity,
        totalAmount: Number(row.total_amount), currency: row.currency, certificateNo: row.certificate_number,
        status: row.status.toUpperCase(), createdAt: row.issued_at, revokedAt: row.revoked_at,
        source: row.source, orderReference: row.presale_order_reference,
        campaignName: row.presale_order_reference ? campaignByOrder.get(row.presale_order_reference) ?? null : null,
      };
    });
    const issued = shares.filter((share) => share.status === "ISSUED");
    return {
      shares,
      summary: {
        registerEntries: Number(ledgerSummary?.register_entries ?? 0),
        shareholderCount: Number(ledgerSummary?.shareholder_count ?? new Set(issued.map((share) => share.profileId)).size),
        certificateCount: Number(ledgerSummary?.certificate_count ?? issued.length),
        issuedShares: Number(ledgerSummary?.issued_shares ?? issued.reduce((sum, share) => sum + share.quantity, 0)),
        revokedShares: Number(ledgerSummary?.revoked_shares ?? shares.filter((share) => share.status === "REVOKED").reduce((sum, share) => sum + share.quantity, 0)),
      },
    };
  },
);
