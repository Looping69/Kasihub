// Author: Klaasvaakie ( |╲ )
import { APIError } from "encore.dev/api";
import { commerceDb, financeDb, membershipDb, sharesDb } from "../../resources";
import {
  captureWalletHold,
  completeOperation,
  creditDistribution,
  failOperation,
  type FinancialOperation,
  placeWalletHold,
  recordStep,
} from "./core";

type StoredOperation = FinancialOperation & { requestPayload: Record<string, unknown> };

export async function resumeFinancialOperation(operationId: string): Promise<void> {
  const row = await financeDb.rawQueryRow<{
    id: string;
    operation_type: string;
    actor_user_id: string | null;
    profile_id: string | null;
    idempotency_key_hash: string;
    request_payload: Record<string, unknown>;
    created_at: string;
    state: FinancialOperation["state"];
    result: unknown;
    retry_count: number;
  }>(`SELECT id, operation_type, actor_user_id, profile_id, idempotency_key_hash,
        request_payload, created_at, state, result, retry_count
      FROM financial_operations WHERE id = $1`, operationId);
  if (!row) throw APIError.notFound("Financial operation not found");
  const operation: StoredOperation = {
    id: row.id,
    operationType: row.operation_type,
    actorUserId: row.actor_user_id,
    profileId: row.profile_id,
    idempotencyKeyHash: row.idempotency_key_hash,
    createdAt: row.created_at,
    state: row.state,
    result: row.result,
    retryCount: row.retry_count,
    requestPayload: row.request_payload,
  };

  try {
    switch (operation.operationType) {
      case "share_purchase":
        await resumeSharePurchase(operation);
        return;
      case "marketplace_order":
        await resumeMarketplaceOrder(operation);
        return;
      case "roots_bank_purchase":
        await resumeRootsBankPurchase(operation);
        return;
      case "membership_subscription":
        await resumeMembershipSubscription(operation);
        return;
      case "dividend_distribution":
        await resumeDividendDistribution(operation);
        return;
      case "pool_distribution":
        await resumePoolDistribution(operation);
        return;
      default:
        throw APIError.failedPrecondition(`Operation type ${operation.operationType} has no safe automatic retry handler`);
    }
  } catch (error) {
    return failOperation(operation, error);
  }
}

async function resumeSharePurchase(operation: StoredOperation): Promise<void> {
  if (!operation.profileId) throw new Error("share_purchase_profile_missing");
  const purchase = await sharesDb.rawQueryRow<{
    id: string; phase_id: string; quantity: number; bonus_quantity: number; total_amount: string; certificate_id: string | null; status: string;
  }>(`SELECT id, phase_id, quantity, bonus_quantity, total_amount::text AS total_amount, certificate_id, status
      FROM share_purchases WHERE operation_id = $1`, operation.id);
  if (!purchase) throw APIError.failedPrecondition("Share inventory was never reserved; replay the original request");
  if (purchase.status === "failed") {
    const tx = await sharesDb.begin();
    try {
      const reserved = await tx.rawQueryRow<{ id: string }>(`UPDATE share_phases
        SET quantity_available = quantity_available - $2, updated_at = now()
        WHERE id = $1 AND status = 'active' AND quantity_available >= $2 RETURNING id`,
      purchase.phase_id, purchase.quantity + purchase.bonus_quantity);
      if (!reserved) throw APIError.failedPrecondition("Share phase is closed or does not have enough inventory");
      await tx.rawExec("UPDATE share_purchases SET status = 'reserved' WHERE id = $1", purchase.id);
      await tx.commit();
      await recordStep(operation, "reserve_inventory", "completed", {
        retried: true,
        purchaseId: purchase.id,
        reservedQuantity: purchase.quantity + purchase.bonus_quantity,
      });
    } catch (error) { await tx.rollback(); throw error; }
  }
  const phase = await sharesDb.rawQueryRow<{ currency: string }>("SELECT currency FROM share_phases WHERE id = $1", purchase.phase_id);
  if (!phase) throw new Error("share_phase_not_found");
  await placeWalletHold(operation, operation.profileId, phase.currency, purchase.total_amount);
  await captureWalletHold(operation, "share_revenue", "Wallet-funded share purchase retry");
  await recordStep(operation, "capture_wallet_funds", "completed", { retried: true, purchaseId: purchase.id });

  let certificate = purchase.certificate_id
    ? await sharesDb.rawQueryRow<{ id: string; certificate_number: string }>(
      "SELECT id, certificate_number FROM share_certificates WHERE id = $1", purchase.certificate_id)
    : null;
  if (!certificate) {
    const tx = await sharesDb.begin();
    try {
      const locked = await tx.rawQueryRow<{ certificate_id: string | null }>(
        "SELECT certificate_id FROM share_purchases WHERE id = $1 FOR UPDATE", purchase.id);
      if (!locked) throw new Error("share_purchase_not_found");
      if (locked.certificate_id) {
        certificate = await tx.rawQueryRow<{ id: string; certificate_number: string }>(
          "SELECT id, certificate_number FROM share_certificates WHERE id = $1", locked.certificate_id);
      } else {
        const id = crypto.randomUUID();
        const number = `CERT-${crypto.randomUUID().toUpperCase()}`;
        await tx.rawExec(`INSERT INTO share_certificates
          (id, profile_id, certificate_number, total_shares, status, issued_at)
          VALUES ($1, $2, $3, $4, 'issued', now())`,
        id, operation.profileId, number, purchase.quantity + purchase.bonus_quantity);
        await tx.rawExec("UPDATE share_purchases SET certificate_id = $2, status = 'paid' WHERE id = $1", purchase.id, id);
        certificate = { id, certificate_number: number };
      }
      await tx.commit();
    } catch (error) { await tx.rollback(); throw error; }
  }
  if (!certificate) throw new Error("share_certificate_not_created");
  await recordStep(operation, "issue_certificate", "completed", { retried: true, purchaseId: purchase.id });
  await completeOperation(operation, {
    operationId: operation.id,
    purchaseId: purchase.id,
    status: "completed",
    totalAmount: purchase.total_amount,
    bonusQuantity: purchase.bonus_quantity,
    certificateNumber: certificate.certificate_number,
  });
}

async function resumeMarketplaceOrder(operation: StoredOperation): Promise<void> {
  if (!operation.profileId) throw new Error("marketplace_profile_missing");
  const order = await commerceDb.rawQueryRow<{
    id: string; product_id: string; product_name: string; amount: string; commission: string; pricing_tier: string; currency: string; created_at: string;
  }>(`SELECT id, product_id, product_name, amount::text AS amount, commission::text AS commission,
        pricing_tier, currency, created_at FROM marketplace_orders WHERE operation_id = $1`, operation.id);
  if (!order) throw APIError.failedPrecondition("Marketplace order was never created; replay the original request");
  await placeWalletHold(operation, operation.profileId, order.currency, order.amount);
  await captureWalletHold(operation, "marketplace_revenue", `${order.product_name} retry`);
  await commerceDb.rawExec("UPDATE marketplace_orders SET status = 'COMPLETED' WHERE id = $1", order.id);
  await recordStep(operation, "capture_wallet_funds", "completed", { retried: true, orderId: order.id });
  const price = Number(order.amount);
  const commission = Number(order.commission);
  await completeOperation(operation, {
    order: { id: order.id, productId: order.product_id, productName: order.product_name, amount: price, commission,
      pricingTier: order.pricing_tier, status: "COMPLETED", createdAt: order.created_at },
    price, pricingTier: order.pricing_tier, commission, poolBenefit: Number((commission * 0.05).toFixed(2)),
    operationId: operation.id, status: "completed",
  });
}

async function resumeRootsBankPurchase(operation: StoredOperation): Promise<void> {
  if (!operation.profileId) throw new Error("roots_bank_profile_missing");
  const share = await commerceDb.rawQueryRow<{
    id: string; profile_id: string; category: string; share_price: string; membership_fee: string; total_amount: string;
    payment_ref: string; pioneer_pool: boolean; created_at: string;
  }>(`SELECT id, profile_id, category, share_price::text AS share_price, membership_fee::text AS membership_fee,
        total_amount::text AS total_amount, payment_ref, pioneer_pool, created_at
      FROM roots_bank_shares WHERE operation_id = $1`, operation.id);
  if (!share) throw APIError.failedPrecondition("Roots Bank share was never created; replay the original request");
  await placeWalletHold(operation, operation.profileId, "ZAR", share.total_amount);
  await captureWalletHold(operation, "roots_bank", "Roots Bank pioneer share retry");
  await commerceDb.rawExec("UPDATE roots_bank_shares SET status = 'REGISTERED' WHERE id = $1", share.id);
  await recordStep(operation, "capture_wallet_funds", "completed", { retried: true, rootsBankShareId: share.id });
  const count = await commerceDb.rawQueryRow<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM roots_bank_shares WHERE status = 'REGISTERED'");
  const pioneerCount = Number(count?.count ?? 0);
  await completeOperation(operation, {
    rootsBankShare: { id: share.id, profileId: share.profile_id, category: share.category,
      sharePrice: Number(share.share_price), membershipFee: Number(share.membership_fee), totalAmount: Number(share.total_amount),
      paymentRef: share.payment_ref, pioneerPool: share.pioneer_pool, status: "REGISTERED", createdAt: share.created_at },
    pioneerCount, pioneerRemaining: Math.max(0, 200 - pioneerCount), operationId: operation.id, status: "completed",
  });
}

async function resumeMembershipSubscription(operation: StoredOperation): Promise<void> {
  const subscription = await membershipDb.rawQueryRow<{ id: string }>(
    "SELECT id FROM subscriptions WHERE operation_id = $1", operation.id);
  if (!subscription) throw APIError.failedPrecondition("Subscription was never created; replay the original request");
  const payment = await membershipDb.rawQueryRow<{ id: string }>(
    "SELECT id FROM payments WHERE subscription_id = $1 ORDER BY created_at LIMIT 1", subscription.id);
  if (!payment) throw APIError.failedPrecondition("Subscription payment record is missing; reconciliation is required");
  await recordStep(operation, "create_pending_subscription", "completed", { retried: true, subscriptionId: subscription.id, paymentId: payment.id });
  await completeOperation(operation, { subscriptionId: subscription.id, paymentId: payment.id, status: "pending", operationId: operation.id });
}

async function resumeDividendDistribution(operation: StoredOperation): Promise<void> {
  const allocations = await distributionAllocations(operation.id);
  const declaration = await financeDb.rawQueryRow<{
    id: string; amount: string; total_shares: number; per_share_amount: string; declared_at: string; paid_at: string | null;
  }>(`SELECT id, amount::text AS amount, total_shares, per_share_amount::text AS per_share_amount, declared_at, paid_at
      FROM dividend_declarations WHERE operation_id = $1`, operation.id);
  if (!declaration || allocations.length === 0) throw APIError.failedPrecondition("Dividend eligibility snapshot is missing; replay is unsafe");
  for (const allocation of allocations) {
    if (Number(allocation.amount) > 0) await creditDistribution({ operation, profileId: allocation.profile_id,
      amount: allocation.amount, source: "DIVIDEND", poolType: "SHAREHOLDERS" });
  }
  await financeDb.rawExec("UPDATE dividend_declarations SET status = 'paid', paid_at = COALESCE(paid_at, now()) WHERE id = $1", declaration.id);
  await recordStep(operation, "credit_recipients", "completed", { retried: true, recipients: allocations.length });
  const paidAt = declaration.paid_at ?? new Date().toISOString();
  await completeOperation(operation, {
    declaration: { id: declaration.id, amount: Number(declaration.amount), totalShares: declaration.total_shares,
      perShareAmount: Number(declaration.per_share_amount), status: "PAID", declaredAt: declaration.declared_at, paidAt },
    distributedTo: allocations.filter((item) => Number(item.amount) > 0).length,
    totalShares: declaration.total_shares, perShareAmount: Number(declaration.per_share_amount),
    operationId: operation.id, status: "completed",
  });
}

async function resumePoolDistribution(operation: StoredOperation): Promise<void> {
  const allocations = await distributionAllocations(operation.id);
  if (allocations.length === 0) throw APIError.failedPrecondition("Pool eligibility snapshot is missing; replay is unsafe");
  const source = typeof operation.requestPayload.source === "string" ? operation.requestPayload.source : "MANUAL";
  for (const allocation of allocations) {
    if (Number(allocation.amount) > 0) await creditDistribution({ operation, profileId: allocation.profile_id,
      amount: allocation.amount, source, poolType: "SHAREHOLDERS" });
  }
  await recordStep(operation, "credit_recipients", "completed", { retried: true, recipients: allocations.length });
  const total = Number(allocations.reduce((sum, item) => sum + Number(item.amount), 0).toFixed(2));
  await completeOperation(operation, {
    distributed: allocations.filter((item) => Number(item.amount) > 0).length,
    perMember: Number((total / allocations.length).toFixed(2)), totalDistributed: total,
    operationId: operation.id, status: "completed",
  });
}

async function distributionAllocations(operationId: string) {
  return financeDb.rawQueryAll<{ profile_id: string; amount: string }>(
    "SELECT profile_id, amount::text AS amount FROM distribution_allocations WHERE operation_id = $1 ORDER BY profile_id",
    operationId,
  );
}
