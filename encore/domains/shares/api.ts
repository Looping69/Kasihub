// Author: Klaasvaakie ( |╲ )
import { api, APIError } from "encore.dev/api";
import { StructKeyspace, expireInSeconds } from "encore.dev/storage/cache";
import { z } from "zod";
import { applicationCache, auditDb, documentsBucket, financeDb, sharesDb } from "../../resources";
import { requireAdminAccess, requireProfileAccess } from "../auth/access";
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
  totalShares?: number;
  bonusBuyOneGet?: boolean;
  createdAt?: string;
  updatedAt?: string;
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
  { certificates: { certificateNumber: string; totalShares: number; status: string; issuedAt: string; revokedAt: string | null }[] }
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
    }>("SELECT certificate_number, total_shares, status, issued_at, revoked_at FROM share_certificates WHERE profile_id = $1 ORDER BY issued_at DESC",
      req.profileId,
    );
    return {
      certificates: rows.map((row) => ({
        certificateNumber: row.certificate_number,
        totalShares: row.total_shares,
        status: row.status,
        issuedAt: row.issued_at,
        revokedAt: row.revoked_at,
      })),
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
    const cached = await cacheRead(sharePhaseCache, "all-v1");
    if (cached) return cached;
    const rows = await sharesDb.rawQueryAll<{
      id: string;
      phase_number: number;
      quantity_available: number;
      price_per_share: string;
      currency: string;
      status: string;
    }>("SELECT id, phase_number, quantity_available, price_per_share::text AS price_per_share, currency, status FROM share_phases ORDER BY phase_number");
    if (rows.length === 0) {
      await sharesDb.rawExec(`INSERT INTO share_phases (phase_number, quantity_available, price_per_share, currency, status, starts_at)
         VALUES (1, 100000, 25.00, 'USD', 'active', now())
         ON CONFLICT (phase_number) DO UPDATE SET quantity_available = EXCLUDED.quantity_available, price_per_share = EXCLUDED.price_per_share, currency = EXCLUDED.currency, status = EXCLUDED.status`,
      );
      const seeded = await sharesDb.rawQueryAll<{
        id: string;
        phase_number: number;
        quantity_available: number;
        price_per_share: string;
        currency: string;
        status: string;
      }>("SELECT id, phase_number, quantity_available, price_per_share::text AS price_per_share, currency, status FROM share_phases ORDER BY phase_number");
      const response = {
        phases: seeded.map((row) => ({
          id: row.id,
          phaseNumber: row.phase_number,
          quantityAvailable: row.quantity_available,
          pricePerShare: row.price_per_share,
          currency: row.currency,
          status: row.status,
        })),
      };
      await cacheWrite(sharePhaseCache, "all-v1", response);
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
      })),
    };
    await cacheWrite(sharePhaseCache, "all-v1", response);
    return response;
  },
);

export const purchaseShares = api<SharePurchaseRequest, SharePurchaseResponse>(
  { method: "POST", path: "/shares/purchase", expose: true },
  async (req) => {
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
      await cacheDelete(sharePhaseCache, "all-v1");
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
    await cacheDelete(sharePhaseCache, "all-v1");
    return { phase: { id: row.id, phaseNumber: row.phase_number, quantityAvailable: row.quantity_available, totalShares: row.total_quantity, pricePerShare: row.price_per_share, currency: row.currency, status: row.status, bonusBuyOneGet: row.bonus_buy_one_get, createdAt: row.created_at, updatedAt: row.updated_at } };
  },
);

export const adminShareCertificates = api<
  { limit?: number },
  { shares: { id: string; profileId: string; phase: number; pricePerShare: number; quantity: number; totalAmount: number; certificateNo: string; status: string; createdAt: string }[] }
>(
  { method: "GET", path: "/admin/shares", expose: true },
  async (req) => {
    await requireAdminAccess();
    const rows = await sharesDb.rawQueryAll<{
      id: string; profile_id: string; phase_number: number; price_per_share: string; total_shares: number;
      total_amount: string; certificate_number: string; status: string; issued_at: string;
    }>(
      `SELECT c.id, c.profile_id, COALESCE(p.phase_number, 1) AS phase_number,
              COALESCE(p.price_per_share, 0)::text AS price_per_share, c.total_shares,
              COALESCE(sp.total_amount, 0)::text AS total_amount, c.certificate_number, c.status, c.issued_at
       FROM share_certificates c
       LEFT JOIN LATERAL (
         SELECT purchase.phase_id, purchase.total_amount FROM share_purchases purchase
         WHERE purchase.profile_id = c.profile_id AND purchase.created_at <= c.issued_at
         ORDER BY purchase.created_at DESC LIMIT 1
       ) sp ON true
       LEFT JOIN share_phases p ON p.id = sp.phase_id
       ORDER BY c.issued_at DESC LIMIT $1`,
      Math.min(Math.max(req.limit ?? 50, 1), 500),
    );
    return { shares: rows.map((row) => ({ id: row.id, profileId: row.profile_id, phase: row.phase_number, pricePerShare: Number(row.price_per_share), quantity: row.total_shares, totalAmount: Number(row.total_amount), certificateNo: row.certificate_number, status: row.status.toUpperCase(), createdAt: row.issued_at })) };
  },
);
