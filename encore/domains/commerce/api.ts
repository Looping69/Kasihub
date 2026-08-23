// Author: Klaasvaakie ( |╲ )
import { api, APIError } from "encore.dev/api";
import { commerceDb, identityDb, membershipDb } from "../../resources";
import { requireAdminAccess, requireEcosystemProfileAccess } from "../auth/access";
import {
  beginOperation,
  captureWalletHold,
  completeOperation,
  failOperation,
  placeWalletHold,
  recordStep,
  releaseWalletHold,
  requireIdempotencyKey,
} from "../workflows/core";

type MarketplaceProductRow = {
  id: string;
  name: string;
  description: string;
  category: string;
  provider: string;
  price: string;
  free_price: string;
  currency: string;
  commission_pct: string;
  image_color: string;
  rating: string;
  popular: boolean;
  created_at: string;
};

type MarketplaceProductResponse = {
  id: string;
  name: string;
  description: string;
  category: string;
  provider: string;
  price: number;
  freePrice: number;
  currency: string;
  commissionPct: number;
  imageColor: string;
  rating: number;
  popular: boolean;
  createdAt: string;
  displayPrice?: number;
};

type MarketplaceOrderResponse = {
  id: string;
  productId: string;
  productName: string;
  amount: number;
  commission: number;
  pricingTier: string;
  status: string;
  createdAt: string;
};

export const marketplace = api<
  { profileId?: string; category?: string },
  { products: MarketplaceProductResponse[]; recentOrders: MarketplaceOrderResponse[]; isFreeMember: boolean; pricingTier: string }
>(
  { method: "GET", path: "/marketplace", expose: true },
  async (req) => {
    let isFreeMember = false;
    if (req.profileId) {
      await requireEcosystemProfileAccess(req.profileId);
      const subscription = await membershipDb.rawQueryRow<{ status: string }>(
        "SELECT status FROM subscriptions WHERE profile_id = $1 ORDER BY starts_at DESC LIMIT 1",
        req.profileId,
      );
      isFreeMember = subscription?.status !== "active";
    }
    const products = await commerceDb.rawQueryAll<MarketplaceProductRow>(
      `SELECT id, name, description, category, provider, price::text AS price,
              free_price::text AS free_price, currency, commission_pct::text AS commission_pct,
              image_color, rating::text AS rating, popular, created_at
       FROM marketplace_products
       WHERE ($1 = '' OR $1 = 'ALL' OR category = $1)
       ORDER BY popular DESC, name`,
      req.category ?? "",
    );
    const orders = req.profileId
      ? await commerceDb.rawQueryAll<{
          id: string; product_id: string; product_name: string; amount: string; commission: string;
          pricing_tier: string; status: string; created_at: string;
        }>(
          `SELECT id, product_id, product_name, amount::text AS amount, commission::text AS commission,
                  pricing_tier, status, created_at
           FROM marketplace_orders WHERE profile_id = $1 ORDER BY created_at DESC LIMIT 8`,
          req.profileId,
        )
      : [];
    return {
      products: products.map((product) => ({
        ...marketplaceProduct(product),
        displayPrice: Number(isFreeMember ? product.free_price : product.price),
      })),
      recentOrders: orders.map((order) => ({
        id: order.id,
        productId: order.product_id,
        productName: order.product_name,
        amount: Number(order.amount),
        commission: Number(order.commission),
        pricingTier: order.pricing_tier,
        status: order.status,
        createdAt: order.created_at,
      })),
      isFreeMember,
      pricingTier: isFreeMember ? "FREE" : "PAID",
    };
  },
);

export const placeMarketplaceOrder = api<
  { profileId: string; productId: string },
  { order: MarketplaceOrderResponse; price: number; pricingTier: string; commission: number; poolBenefit: number; operationId: string; status: string }
>(
  { method: "POST", path: "/marketplace/orders", expose: true },
  async (req) => {
    const session = await requireEcosystemProfileAccess(req.profileId);
    const idempotencyKey = requireIdempotencyKey();
    const product = await commerceDb.rawQueryRow<MarketplaceProductRow>(
      `SELECT id, name, description, category, provider, price::text AS price,
              free_price::text AS free_price, currency, commission_pct::text AS commission_pct,
              image_color, rating::text AS rating, popular, created_at
       FROM marketplace_products WHERE id = $1`,
      req.productId,
    );
    if (!product) throw new Error("product_not_found");
    const subscription = await membershipDb.rawQueryRow<{ status: string }>(
      "SELECT status FROM subscriptions WHERE profile_id = $1 ORDER BY starts_at DESC LIMIT 1",
      req.profileId,
    );
    const isFreeMember = subscription?.status !== "active";
    const price = Number(isFreeMember ? product.free_price : product.price);
    const pricingTier = isFreeMember ? "FREE" : "PAID";
    const commission = Number((price * Number(product.commission_pct) / 100).toFixed(2));
    const started = await beginOperation<{
      order: MarketplaceOrderResponse; price: number; pricingTier: string; commission: number; poolBenefit: number; operationId: string; status: string;
    }>({ operationType: "marketplace_order", actorUserId: session.user.id, profileId: req.profileId, idempotencyKey, payload: req });
    if (started.operation.state === "completed" && started.operation.result) return started.operation.result;
    const operation = started.operation;
    try {
      let order = await commerceDb.rawQueryRow<{
        id: string; created_at: string; status: string; amount: string; commission: string; pricing_tier: string; currency: string;
      }>(`SELECT id, created_at, status, amount::text AS amount, commission::text AS commission, pricing_tier, currency
          FROM marketplace_orders WHERE operation_id = $1`, operation.id);
      if (!order) {
        order = await commerceDb.rawQueryRow(`INSERT INTO marketplace_orders
          (id, profile_id, product_id, product_name, amount, pricing_tier, commission, status, operation_id, currency)
          VALUES ($1, $2, $3, $4, $5::numeric, $6, $7::numeric, 'PROCESSING', $8, $9)
          RETURNING id, created_at, status, amount::text AS amount, commission::text AS commission, pricing_tier, currency`,
          crypto.randomUUID(), req.profileId, product.id, product.name, price.toFixed(2), pricingTier, commission.toFixed(2), operation.id, product.currency);
      }
      if (!order) throw new Error("marketplace_order_not_created");
      await recordStep(operation, "create_order", "completed", { orderId: order.id });
      await placeWalletHold(operation, req.profileId, order.currency, order.amount);
      await recordStep(operation, "hold_wallet_funds", "completed", { amount: order.amount, currency: order.currency });
      await captureWalletHold(operation, "marketplace_revenue", `${product.name} - ${product.provider}`);
      await recordStep(operation, "capture_wallet_funds", "completed", { orderId: order.id });
      await commerceDb.rawExec("UPDATE marketplace_orders SET status = 'COMPLETED' WHERE id = $1", order.id);
      const orderPrice = Number(order.amount);
      const orderCommission = Number(order.commission);
      const result = {
        order: { id: order.id, productId: product.id, productName: product.name, amount: orderPrice, commission: orderCommission, pricingTier: order.pricing_tier, status: "COMPLETED", createdAt: order.created_at },
        price: orderPrice, pricingTier: order.pricing_tier, commission: orderCommission,
        poolBenefit: Number((orderCommission * 0.05).toFixed(2)), operationId: operation.id, status: "completed",
      };
      return completeOperation(operation, result);
    } catch (error) {
      try { await releaseWalletHold(operation.id); } catch { /* captured funds require reconciliation, not release */ }
      return failOperation(operation, error);
    }
  },
);

export const adminMarketplace = api<void, { products: MarketplaceProductResponse[]; orders: MarketplaceOrderResponse[] }>(
  { method: "GET", path: "/admin/marketplace", expose: true },
  async () => {
    await requireAdminAccess();
    const products = await commerceDb.rawQueryAll<MarketplaceProductRow>(
      `SELECT id, name, description, category, provider, price::text AS price, free_price::text AS free_price,
              currency, commission_pct::text AS commission_pct, image_color, rating::text AS rating, popular, created_at
       FROM marketplace_products ORDER BY popular DESC, name`,
    );
    const orders = await commerceDb.rawQueryAll<{
      id: string; product_id: string; product_name: string; amount: string; commission: string;
      pricing_tier: string; status: string; created_at: string;
    }>(
      `SELECT id, product_id, product_name, amount::text AS amount, commission::text AS commission,
              pricing_tier, status, created_at FROM marketplace_orders ORDER BY created_at DESC LIMIT 50`,
    );
    return {
      products: products.map(marketplaceProduct),
      orders: orders.map((order) => ({ id: order.id, productId: order.product_id, productName: order.product_name, amount: Number(order.amount), commission: Number(order.commission), pricingTier: order.pricing_tier, status: order.status, createdAt: order.created_at })),
    };
  },
);

export const createMarketplaceProduct = api<
  { name: string; description: string; category: string; provider: string; price: number; freePrice?: number; commissionPct?: number; imageColor?: string; rating?: number; popular?: boolean },
  { product: MarketplaceProductResponse }
>(
  { method: "POST", path: "/admin/marketplace/products", expose: true },
  async (req) => {
    await requireAdminAccess();
    const row = await commerceDb.rawQueryRow<MarketplaceProductRow>(
      `INSERT INTO marketplace_products (name, description, category, provider, price, free_price, commission_pct, image_color, rating, popular)
       VALUES ($1, $2, $3, $4, $5::numeric, $6::numeric, $7::numeric, $8, $9::numeric, $10)
       RETURNING id, name, description, category, provider, price::text AS price, free_price::text AS free_price,
                 currency, commission_pct::text AS commission_pct, image_color, rating::text AS rating, popular, created_at`,
      req.name, req.description, req.category, req.provider, req.price.toFixed(2),
      (req.freePrice ?? req.price * 1.15).toFixed(2), (req.commissionPct ?? 0).toFixed(4),
      req.imageColor ?? "emerald", (req.rating ?? 4.5).toFixed(2), req.popular ?? false,
    );
    if (!row) throw new Error("product_create_failed");
    return { product: marketplaceProduct(row) };
  },
);

export const updateMarketplaceProduct = api<
  { productId: string; name?: string; description?: string; category?: string; provider?: string; price?: number; freePrice?: number; commissionPct?: number; imageColor?: string; rating?: number; popular?: boolean },
  { product: MarketplaceProductResponse }
>(
  { method: "PATCH", path: "/admin/marketplace/products/:productId", expose: true },
  async (req) => {
    await requireAdminAccess();
    const row = await commerceDb.rawQueryRow<MarketplaceProductRow>(
      `UPDATE marketplace_products SET
         name = COALESCE($2, name), description = COALESCE($3, description), category = COALESCE($4, category),
         provider = COALESCE($5, provider), price = COALESCE($6::numeric, price), free_price = COALESCE($7::numeric, free_price),
         commission_pct = COALESCE($8::numeric, commission_pct), image_color = COALESCE($9, image_color),
         rating = COALESCE($10::numeric, rating), popular = COALESCE($11, popular), updated_at = now()
       WHERE id = $1
       RETURNING id, name, description, category, provider, price::text AS price, free_price::text AS free_price,
                 currency, commission_pct::text AS commission_pct, image_color, rating::text AS rating, popular, created_at`,
      req.productId, req.name ?? null, req.description ?? null, req.category ?? null, req.provider ?? null,
      req.price?.toFixed(2) ?? null, req.freePrice?.toFixed(2) ?? null, req.commissionPct?.toFixed(4) ?? null,
      req.imageColor ?? null, req.rating?.toFixed(2) ?? null, req.popular ?? null,
    );
    if (!row) throw new Error("product_not_found");
    return { product: marketplaceProduct(row) };
  },
);

export const deleteMarketplaceProduct = api<{ productId: string }, { success: true }>(
  { method: "DELETE", path: "/admin/marketplace/products/:productId", expose: true },
  async (req) => {
    await requireAdminAccess();
    await commerceDb.rawExec("DELETE FROM marketplace_products WHERE id = $1", req.productId);
    return { success: true };
  },
);

function marketplaceProduct(row: MarketplaceProductRow): MarketplaceProductResponse {
  return {
    id: row.id, name: row.name, description: row.description, category: row.category, provider: row.provider,
    price: Number(row.price), freePrice: Number(row.free_price), currency: row.currency,
    commissionPct: Number(row.commission_pct), imageColor: row.image_color, rating: Number(row.rating),
    popular: row.popular, createdAt: row.created_at,
  };
}

type RootsBankShareResponse = {
  id: string;
  profileId: string;
  category: string;
  sharePrice: number;
  membershipFee: number;
  totalAmount: number;
  paymentRef: string;
  pioneerPool: boolean;
  status: string;
  createdAt: string;
};

export const rootsBank = api<
  { profileId: string },
  { pioneerCount: number; myShare: RootsBankShareResponse | null }
>(
  { method: "GET", path: "/rootsbank/:profileId", expose: true },
  async (req) => {
    await requireEcosystemProfileAccess(req.profileId);
    const count = await commerceDb.rawQueryRow<{ count: string }>("SELECT COUNT(*)::text AS count FROM roots_bank_shares");
    const share = await commerceDb.rawQueryRow<{
      id: string; profile_id: string; category: string; share_price: string; membership_fee: string;
      total_amount: string; payment_ref: string; pioneer_pool: boolean; status: string; created_at: string;
    }>(
      `SELECT id, profile_id, category, share_price::text AS share_price, membership_fee::text AS membership_fee,
              total_amount::text AS total_amount, payment_ref, pioneer_pool, status, created_at
       FROM roots_bank_shares WHERE profile_id = $1`,
      req.profileId,
    );
    return { pioneerCount: Number(count?.count ?? 0), myShare: share ? rootsBankShare(share) : null };
  },
);

export const purchaseRootsBankShare = api<
  { profileId: string; category: "KIDS_STUDENT" | "ADULT" | "PENSIONER"; paymentRef?: string },
  { rootsBankShare: RootsBankShareResponse; pioneerCount: number; pioneerRemaining: number; operationId: string; status: string }
>(
  { method: "POST", path: "/rootsbank/purchase", expose: true },
  async (req) => {
    const session = await requireEcosystemProfileAccess(req.profileId);
    const idempotencyKey = requireIdempotencyKey();
    const membershipFee = req.category === "ADULT" ? 200 : 50;
    const sharePrice = 500;
    const totalAmount = sharePrice + membershipFee;
    const started = await beginOperation<{
      rootsBankShare: RootsBankShareResponse; pioneerCount: number; pioneerRemaining: number; operationId: string; status: string;
    }>({ operationType: "roots_bank_purchase", actorUserId: session.user.id, profileId: req.profileId, idempotencyKey, payload: req });
    if (started.operation.state === "completed" && started.operation.result) return started.operation.result;
    const operation = started.operation;
    try {
      const existingOwner = await commerceDb.rawQueryRow<{ id: string; operation_id: string | null }>(
        "SELECT id, operation_id FROM roots_bank_shares WHERE profile_id = $1", req.profileId);
      if (existingOwner && existingOwner.operation_id !== operation.id) throw APIError.alreadyExists("Member already owns a Roots Bank pioneer share");
      await placeWalletHold(operation, req.profileId, "ZAR", totalAmount.toFixed(2));
      await recordStep(operation, "hold_wallet_funds", "completed", { amount: totalAmount, currency: "ZAR" });
      let row = await commerceDb.rawQueryRow<{
        id: string; profile_id: string; category: string; share_price: string; membership_fee: string;
        total_amount: string; payment_ref: string; pioneer_pool: boolean; status: string; created_at: string;
      }>(`SELECT id, profile_id, category, share_price::text AS share_price, membership_fee::text AS membership_fee,
              total_amount::text AS total_amount, payment_ref, pioneer_pool, status, created_at
          FROM roots_bank_shares WHERE operation_id = $1`, operation.id);
      if (!row) {
        const id = crypto.randomUUID();
        const paymentRef = req.paymentRef ?? `RBS-${crypto.randomUUID().toUpperCase()}`;
        row = await commerceDb.rawQueryRow(`INSERT INTO roots_bank_shares
          (id, profile_id, category, share_price, membership_fee, total_amount, payment_ref, status, operation_id)
          VALUES ($1, $2, $3, $4::numeric, $5::numeric, $6::numeric, $7, 'PROCESSING', $8)
          RETURNING id, profile_id, category, share_price::text AS share_price, membership_fee::text AS membership_fee,
                    total_amount::text AS total_amount, payment_ref, pioneer_pool, status, created_at`,
          id, req.profileId, req.category, sharePrice.toFixed(2), membershipFee.toFixed(2), totalAmount.toFixed(2), paymentRef, operation.id);
      }
      if (!row) throw new Error("roots_bank_purchase_failed");
      await recordStep(operation, "create_pioneer_share", "completed", { rootsBankShareId: row.id });
      await captureWalletHold(operation, "roots_bank", "Roots Bank pioneer share");
      await commerceDb.rawExec("UPDATE roots_bank_shares SET status = 'REGISTERED' WHERE id = $1", row.id);
      row.status = "REGISTERED";
      await recordStep(operation, "capture_wallet_funds", "completed", { rootsBankShareId: row.id });
      const count = await commerceDb.rawQueryRow<{ count: string }>("SELECT COUNT(*)::text AS count FROM roots_bank_shares WHERE status = 'REGISTERED'");
      const pioneerCount = Number(count?.count ?? 0);
      return completeOperation(operation, { rootsBankShare: rootsBankShare(row), pioneerCount, pioneerRemaining: Math.max(0, 200 - pioneerCount), operationId: operation.id, status: "completed" });
    } catch (error) {
      try { await releaseWalletHold(operation.id); } catch { /* captured funds require reconciliation, not release */ }
      return failOperation(operation, error);
    }
  },
);

export const adminRootsBank = api<void, { pioneers: RootsBankShareResponse[] }>(
  { method: "GET", path: "/admin/rootsbank", expose: true },
  async () => {
    await requireAdminAccess();
    const rows = await commerceDb.rawQueryAll<{
      id: string; profile_id: string; category: string; share_price: string; membership_fee: string;
      total_amount: string; payment_ref: string; pioneer_pool: boolean; status: string; created_at: string;
    }>(
      `SELECT id, profile_id, category, share_price::text AS share_price, membership_fee::text AS membership_fee,
              total_amount::text AS total_amount, payment_ref, pioneer_pool, status, created_at
       FROM roots_bank_shares ORDER BY created_at`,
    );
    return { pioneers: rows.map(rootsBankShare) };
  },
);

function rootsBankShare(row: {
  id: string; profile_id: string; category: string; share_price: string; membership_fee: string;
  total_amount: string; payment_ref: string; pioneer_pool: boolean; status: string; created_at: string;
}): RootsBankShareResponse {
  return {
    id: row.id, profileId: row.profile_id, category: row.category, sharePrice: Number(row.share_price),
    membershipFee: Number(row.membership_fee), totalAmount: Number(row.total_amount), paymentRef: row.payment_ref,
    pioneerPool: row.pioneer_pool, status: row.status, createdAt: row.created_at,
  };
}

type MallTransactionResponse = {
  id: string; nfcTagId: string; storeName: string; amount: number; costOfSale: number;
  vat: number; sharePool: number; kasiPool: number; status: string; createdAt: string;
};

type SiloResponse = { id: string; name: string; percentage: number; description: string | null; color: string; sortOrder: number; updatedAt: string };

export const mall = api<{ profileId: string }, { transactions: MallTransactionResponse[]; silos: SiloResponse[]; memberCount: number }>(
  { method: "GET", path: "/mall/:profileId", expose: true },
  async (req) => {
    await requireEcosystemProfileAccess(req.profileId);
    const transactions = await mallTransactions(req.profileId, 20);
    const silos = await commerceDb.rawQueryAll<{ id: string; name: string; percentage: string; description: string | null; color: string; sort_order: number; updated_at: string }>(
      "SELECT id, name, percentage::text AS percentage, description, color, sort_order, updated_at FROM silo_config ORDER BY sort_order",
    );
    const members = await identityDb.rawQueryRow<{ count: string }>("SELECT COUNT(*)::text AS count FROM profiles");
    return { transactions, silos: silos.map(siloResponse), memberCount: Number(members?.count ?? 0) };
  },
);

export const adminMall = api<{ limit?: number }, { transactions: MallTransactionResponse[]; silos: SiloResponse[]; memberCount: number }>(
  { method: "GET", path: "/admin/mall", expose: true },
  async (req) => {
    await requireAdminAccess();
    const transactions = await mallTransactions(null, Math.min(Math.max(req.limit ?? 100, 1), 500));
    const silos = await commerceDb.rawQueryAll<{ id: string; name: string; percentage: string; description: string | null; color: string; sort_order: number; updated_at: string }>(
      "SELECT id, name, percentage::text AS percentage, description, color, sort_order, updated_at FROM silo_config ORDER BY sort_order",
    );
    const members = await identityDb.rawQueryRow<{ count: string }>("SELECT COUNT(*)::text AS count FROM profiles");
    return { transactions, silos: silos.map(siloResponse), memberCount: Number(members?.count ?? 0) };
  },
);

export const updateSilos = api<
  { silos: { id: string; percentage: number; name?: string; description?: string }[] },
  { silos: SiloResponse[]; total: number }
>(
  { method: "PATCH", path: "/admin/mall/silos", expose: true },
  async (req) => {
    await requireAdminAccess();
    const total = req.silos.reduce((sum, silo) => sum + silo.percentage, 0);
    if (Math.abs(total - 100) > 0.01) throw new Error("silo_total_must_equal_100");
    for (const silo of req.silos) {
      await commerceDb.rawExec(
        `UPDATE silo_config SET percentage = $2::numeric, name = COALESCE($3, name),
                description = COALESCE($4, description), updated_at = now() WHERE id = $1`,
        silo.id, silo.percentage.toFixed(4), silo.name ?? null, silo.description ?? null,
      );
    }
    const rows = await commerceDb.rawQueryAll<{ id: string; name: string; percentage: string; description: string | null; color: string; sort_order: number; updated_at: string }>(
      "SELECT id, name, percentage::text AS percentage, description, color, sort_order, updated_at FROM silo_config ORDER BY sort_order",
    );
    return { silos: rows.map(siloResponse), total };
  },
);

async function mallTransactions(profileId: string | null, limit: number): Promise<MallTransactionResponse[]> {
  const rows = await commerceDb.rawQueryAll<{
    id: string; nfc_tag_id: string; store_name: string; amount: string; cost_of_sale: string;
    vat: string; share_pool: string; kasi_pool: string; status: string; created_at: string;
  }>(
    `SELECT id, nfc_tag_id, store_name, amount::text AS amount, cost_of_sale::text AS cost_of_sale,
            vat::text AS vat, share_pool::text AS share_pool, kasi_pool::text AS kasi_pool, status, created_at
     FROM mall_transactions WHERE ($1::uuid IS NULL OR profile_id = $1::uuid) ORDER BY created_at DESC LIMIT $2`,
    profileId, limit,
  );
  return rows.map((row) => ({
    id: row.id, nfcTagId: row.nfc_tag_id, storeName: row.store_name, amount: Number(row.amount),
    costOfSale: Number(row.cost_of_sale), vat: Number(row.vat), sharePool: Number(row.share_pool),
    kasiPool: Number(row.kasi_pool), status: row.status, createdAt: row.created_at,
  }));
}

function siloResponse(row: { id: string; name: string; percentage: string; description: string | null; color: string; sort_order: number; updated_at: string }): SiloResponse {
  return { id: row.id, name: row.name, percentage: Number(row.percentage), description: row.description, color: row.color, sortOrder: row.sort_order, updatedAt: row.updated_at };
}


