// Author: Klaasvaakie ( |╲ )
import { api, APIError } from "encore.dev/api";
import { z } from "zod";
import {
  auditDb,
  commerceDb,
  engagementDb,
  financeDb,
  identityDb,
  kycDb,
  membershipDb,
  networkDb,
  sharesDb,
} from "../../resources";
import { requireAdminAccess, sessionFromBearer } from "../auth/access";
import { hashPassword } from "../auth/password";

export const bootstrapMigrationAdmin = api<void, { ok: true; promoted: boolean }>(
  { method: "POST", path: "/migration/bootstrap-admin", expose: true },
  async () => {
    const session = await sessionFromBearer();
    if (!session) throw APIError.unauthenticated("Authentication is required");
    const count = await identityDb.rawQueryRow<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM user_roles ur
       JOIN roles r ON r.id = ur.role_id WHERE r.name = 'admin'`,
    );
    if (Number(count?.count ?? 0) > 0) {
      await requireAdminAccess();
      return { ok: true, promoted: false };
    }
    await identityDb.rawExec(
      `INSERT INTO user_roles (user_id, role_id)
       SELECT $1, id FROM roles WHERE name = 'admin'
       ON CONFLICT (user_id, role_id) DO NOTHING`,
      session.user.id,
    );
    await auditDb.rawExec(
      `INSERT INTO audit_logs (action, entity_type, entity_id, after)
       VALUES ('migration.bootstrap_admin', 'user', $1, $2::jsonb)`,
      session.user.id, JSON.stringify({ email: session.user.email }),
    );
    return { ok: true, promoted: true };
  },
);

const legacyImportRequest = z.object({
  entity: z.string().min(1),
  rows: z.array(z.record(z.string(), z.unknown())).max(250),
});

export const importLegacyBatch = api<
  { entity: string; rows: Record<string, unknown>[] },
  { entity: string; imported: number }
>(
  { method: "POST", path: "/admin/migration/import", expose: true },
  async (req) => {
    await requireAdminAccess();
    const payload = legacyImportRequest.parse(req);
    let imported = 0;
    for (const row of payload.rows) {
      if (payload.entity === "Member") {
        await importLegacyMember(row);
        imported++;
        continue;
      }
      if (payload.entity === "SharePhase") await importLegacySharePhase(row);
      else if (payload.entity === "MatrixNode") await importLegacyMatrixNode(row);
      else if (payload.entity === "Subscription") await importLegacySubscription(row);
      else if (payload.entity === "Transaction") await importLegacyTransaction(row);
      else if (payload.entity === "Share") await importLegacyShare(row);
      else if (payload.entity === "AureusShare") await importLegacyAureusShare(row);
      else if (payload.entity === "DividendDeclaration") await importLegacyDividend(row);
      else if (payload.entity === "KasiPoolDistribution") await importLegacyPoolDistribution(row);
      else if (payload.entity === "MarketplaceProduct") await importLegacyMarketplaceProduct(row);
      else if (payload.entity === "MarketplaceOrder") await importLegacyMarketplaceOrder(row);
      else if (payload.entity === "MallTransaction") await importLegacyMallTransaction(row);
      else if (payload.entity === "RootsBankShare") await importLegacyRootsBankShare(row);
      else if (payload.entity === "RootsBankDuplicate") await importLegacyRootsBankDuplicate(row);
      else if (payload.entity === "Referral") await importLegacyReferral(row);
      else if (payload.entity === "Voucher") await importLegacyVoucher(row);
      else if (payload.entity === "SubscriptionNotification") await importLegacySubscriptionNotification(row);
      else if (payload.entity === "Setting") await importLegacySetting(row);
      else if (payload.entity === "SiloConfig") await importLegacySilo(row);
      else if (payload.entity === "AuditorNotification") await importLegacyAuditNotification(row);
      else if (payload.entity === "WalletBalance") await importLegacyWalletBalance(row);
      else throw new Error(`unsupported_legacy_entity:${payload.entity}`);
      imported++;
      continue;
    }
    await auditDb.rawExec(
      `INSERT INTO audit_logs (action, entity_type, entity_id, after)
       VALUES ('migration.batch_import', $1, gen_random_uuid(), $2::jsonb)`,
      payload.entity, JSON.stringify({ imported }),
    );
    return { entity: payload.entity, imported };
  },
);

async function importLegacyMember(row: Record<string, unknown>) {
  const userId = requiredString(row, "userId");
  const profileId = requiredString(row, "id");
  const email = requiredString(row, "email").toLowerCase();
  await identityDb.rawExec(
    `INSERT INTO users (id, email, password_hash, phone, status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, 'active', $5::timestamptz, $6::timestamptz)
     ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, phone = EXCLUDED.phone, updated_at = EXCLUDED.updated_at`,
    userId, email, hashPassword(requiredString(row, "password")), nullableString(row.mobile),
    requiredString(row, "createdAt"), requiredString(row, "updatedAt"),
  );
  await identityDb.rawExec(
    `INSERT INTO profiles (
       id, user_id, profile_type, unique_profile_number, membership_type, citizenship_type,
       first_name, surname, company_name, company_registration_number, id_or_passport_number,
       sars_number, country, profile_picture_url, status, address_line, city, postal_code,
       beneficiary_name, beneficiary_id, guardian_name, kyc_verified_at, tax_threshold,
       monthly_earnings, nfc_tag_id, visa_card_last4, roots_bank_account, instapay_status,
       instapay_verified_at, instapay_account_ref, upline_profile_number, upline_confirmed,
       created_at, updated_at
     ) VALUES (
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,
       $22::timestamptz,$23,$24::numeric,$25,$26,$27,$28,$29::timestamptz,$30,$31,$32,$33::timestamptz,$34::timestamptz
     )
     ON CONFLICT (id) DO UPDATE SET
       membership_type = EXCLUDED.membership_type, citizenship_type = EXCLUDED.citizenship_type,
       first_name = EXCLUDED.first_name, surname = EXCLUDED.surname, company_name = EXCLUDED.company_name,
       status = EXCLUDED.status, updated_at = EXCLUDED.updated_at`,
    profileId, userId, requiredString(row, "profileType"), requiredString(row, "profileNumber"),
    nullableString(row.membershipType), nullableString(row.citizenshipType), nullableString(row.firstName),
    nullableString(row.lastName), nullableString(row.companyName), nullableString(row.companyRegNo),
    nullableString(row.idPassport), nullableString(row.sarsNumber), nullableString(row.country) ?? "ZA",
    nullableString(row.profilePicture), requiredString(row, "profileStatus"), nullableString(row.addressLine),
    nullableString(row.city), nullableString(row.postalCode), nullableString(row.beneficiaryName),
    nullableString(row.beneficiaryId), nullableString(row.guardianName), nullableString(row.kycVerifiedAt),
    Boolean(row.taxThreshold), Number(row.monthlyEarnings ?? 0).toFixed(2), nullableString(row.nfcTagId),
    nullableString(row.visaCardLast4), nullableString(row.rootsBankAccount), nullableString(row.instapayStatus) ?? "NONE",
    nullableString(row.instapayVerifiedAt), nullableString(row.instapayAccountRef), nullableString(row.uplineProfileNumber),
    Boolean(row.uplineConfirmed), requiredString(row, "createdAt"), requiredString(row, "updatedAt"),
  );
  await identityDb.rawExec(
    `INSERT INTO user_roles (user_id, role_id)
     SELECT $1, id FROM roles WHERE name = $2
     ON CONFLICT (user_id, role_id) DO NOTHING`,
    userId, row.isAdmin ? "admin" : "member",
  );
}

async function importLegacySharePhase(row: Record<string, unknown>) {
  await sharesDb.rawExec(`INSERT INTO share_phases (id, phase_number, quantity_available, total_quantity, price_per_share, currency, status, bonus_buy_one_get, created_at, updated_at)
    VALUES ($1,$2,$3,$4,$5::numeric,'USD',$6,$7,$8::timestamptz,$9::timestamptz)
    ON CONFLICT (phase_number) DO UPDATE SET quantity_available=EXCLUDED.quantity_available,total_quantity=EXCLUDED.total_quantity,price_per_share=EXCLUDED.price_per_share,status=EXCLUDED.status,bonus_buy_one_get=EXCLUDED.bonus_buy_one_get,updated_at=EXCLUDED.updated_at`,
    requiredString(row,"id"),Number(row.phase),Number(row.totalShares)-Number(row.soldShares),Number(row.totalShares),String(row.pricePerShare),requiredString(row,"status").toLowerCase(),Boolean(row.bonusBuyOneGet),requiredString(row,"createdAt"),requiredString(row,"updatedAt"));
}

async function importLegacyMatrixNode(row: Record<string, unknown>) {
  await networkDb.rawExec(`INSERT INTO matrix_nodes (id,profile_id,parent_node_id,sponsor_profile_id,position_index,depth,path,created_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8::timestamptz) ON CONFLICT (profile_id) DO UPDATE SET parent_node_id=EXCLUDED.parent_node_id,sponsor_profile_id=EXCLUDED.sponsor_profile_id,position_index=EXCLUDED.position_index,depth=EXCLUDED.depth,path=EXCLUDED.path`,
    requiredString(row,"id"),requiredString(row,"profileId"),nullableString(row.parentNodeId),nullableString(row.sponsorProfileId),Number(row.position),Number(row.level),requiredString(row,"path"),requiredString(row,"createdAt"));
}

async function importLegacySubscription(row: Record<string, unknown>) {
  const planId=requiredString(row,"planId"); const id=requiredString(row,"id");
  await membershipDb.rawExec(`INSERT INTO membership_plans (id,code,name,member_type,currency,amount,billing_period,active) VALUES ($1,$2,$2,'legacy',$3,$4::numeric,'monthly',true) ON CONFLICT (code) DO NOTHING`,planId,requiredString(row,"planCode"),requiredString(row,"currency"),String(row.amount));
  await membershipDb.rawExec(`INSERT INTO subscriptions (id,profile_id,plan_id,status,starts_at,current_period_end) VALUES ($1,$2,$3,$4,$5::timestamptz,$6::timestamptz) ON CONFLICT (id) DO NOTHING`,id,requiredString(row,"profileId"),planId,requiredString(row,"status").toLowerCase(),requiredString(row,"createdAt"),nullableString(row.periodEnd));
  await membershipDb.rawExec(`INSERT INTO payments (id,profile_id,subscription_id,provider,provider_reference,amount,currency,status,metadata,created_at) VALUES ($1,$2,$3,$4,$5,$6::numeric,$7,$8,'{}'::jsonb,$9::timestamptz) ON CONFLICT (provider_reference) DO NOTHING`,requiredString(row,"paymentId"),requiredString(row,"profileId"),id,requiredString(row,"method"),`legacy:${id}`,String(row.amount),requiredString(row,"currency"),requiredString(row,"status").toLowerCase(),requiredString(row,"createdAt"));
}

async function importLegacyTransaction(row: Record<string, unknown>) {
  const id=requiredString(row,"id"); const existing=await financeDb.rawQueryRow<{id:string}>("SELECT id FROM ledger_transactions WHERE id=$1",id); if(existing)return;
  const profileId=requiredString(row,"profileId"); const amount=Number(row.amount); const memberAccount=requiredString(row,"memberAccountId"); const systemAccount=requiredString(row,"systemAccountId");
  await financeDb.rawExec(`INSERT INTO ledger_accounts (id,owner_type,owner_id,account_code,currency,status) VALUES ($1,'profile',$2,'wallet','ZAR','active') ON CONFLICT (id) DO NOTHING`,memberAccount,profileId);
  await financeDb.rawExec(`INSERT INTO ledger_accounts (id,owner_type,owner_id,account_code,currency,status) VALUES ($1,'system',$2,'legacy-offset','ZAR','active') ON CONFLICT (id) DO NOTHING`,systemAccount,requiredString(row,"systemOwnerId"));
  await financeDb.rawExec(`INSERT INTO ledger_transactions (id,transaction_type,reference_type,reference_id,description,created_at) VALUES ($1,$2,'legacy_transaction',$1,$3,$4::timestamptz)`,id,requiredString(row,"type"),requiredString(row,"description"),requiredString(row,"createdAt"));
  if (amount === 0) return;
  await financeDb.rawExec(`INSERT INTO ledger_entries (id,transaction_id,account_id,direction,amount,currency) VALUES ($1,$2,$3,$4,$5::numeric,'ZAR'),($6,$2,$7,$8,$5::numeric,'ZAR')`,requiredString(row,"memberEntryId"),id,memberAccount,amount>=0?"credit":"debit",Math.abs(amount).toFixed(2),requiredString(row,"systemEntryId"),systemAccount,amount>=0?"debit":"credit");
}

async function importLegacyShare(row: Record<string, unknown>) {
  await sharesDb.rawExec(`INSERT INTO share_purchases (id,profile_id,phase_id,quantity,bonus_quantity,total_amount,status,certificate_id,created_at) SELECT $1,$2,id,$4,0,$5::numeric,$6,$7,$8::timestamptz FROM share_phases WHERE phase_number=$3 ON CONFLICT (id) DO NOTHING`,requiredString(row,"id"),requiredString(row,"profileId"),Number(row.phase),Number(row.quantity),String(row.totalAmount),requiredString(row,"status").toLowerCase(),requiredString(row,"certificateId"),requiredString(row,"createdAt"));
  await sharesDb.rawExec(`INSERT INTO share_certificates (id,profile_id,certificate_number,total_shares,status,issued_at,revoked_at) VALUES ($1,$2,$3,$4,$5,$6::timestamptz,$7::timestamptz) ON CONFLICT (certificate_number) DO NOTHING`,requiredString(row,"certificateId"),requiredString(row,"profileId"),requiredString(row,"certificateNo"),Number(row.quantity),requiredString(row,"status").toLowerCase(),requiredString(row,"createdAt"),row.status==='REVOKED'?requiredString(row,"createdAt"):null);
}

async function importLegacyAureusShare(row: Record<string, unknown>) { await sharesDb.rawExec(`INSERT INTO aureus_share_holdings (id,profile_id,phase_number,price_per_share,quantity,total_amount,certificate_number,previous_certificate_number,status,created_at) VALUES ($1,$2,$3,$4::numeric,$5,$6::numeric,$7,$8,$9,$10::timestamptz) ON CONFLICT (id) DO NOTHING`,requiredString(row,"id"),requiredString(row,"profileId"),Number(row.phase),String(row.pricePerShare),Number(row.quantity),String(row.totalAmount),requiredString(row,"certificateNo"),nullableString(row.prevCertificateNo),requiredString(row,"status").toLowerCase(),requiredString(row,"createdAt")); }
async function importLegacyDividend(row: Record<string, unknown>) { await financeDb.rawExec(`INSERT INTO dividend_declarations (id,amount,total_shares,per_share_amount,status,declared_at,paid_at) VALUES ($1,$2::numeric,$3,$4::numeric,$5,$6::timestamptz,$7::timestamptz) ON CONFLICT (id) DO NOTHING`,requiredString(row,"id"),String(row.amount),Number(row.totalShares),String(row.perShareAmount),requiredString(row,"status").toLowerCase(),requiredString(row,"declaredAt"),nullableString(row.paidAt)); }
async function importLegacyPoolDistribution(row: Record<string, unknown>) { await financeDb.rawExec(`INSERT INTO pool_distributions (id,batch_id,profile_id,amount,source,pool_type,status,payout_date) VALUES ($1,$2,$3,$4::numeric,$5,$6,$7,$8::timestamptz) ON CONFLICT (id) DO NOTHING`,requiredString(row,"id"),requiredString(row,"batchId"),requiredString(row,"profileId"),String(row.amount),requiredString(row,"source"),requiredString(row,"poolType"),requiredString(row,"status").toLowerCase(),requiredString(row,"payoutDate")); }
async function importLegacyMarketplaceProduct(row: Record<string, unknown>) { await commerceDb.rawExec(`INSERT INTO marketplace_products (id,name,description,category,provider,price,free_price,currency,commission_pct,image_color,rating,popular,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6::numeric,$7::numeric,$8,$9::numeric,$10,$11::numeric,$12,$13::timestamptz,$13::timestamptz) ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,price=EXCLUDED.price,free_price=EXCLUDED.free_price`,requiredString(row,"id"),requiredString(row,"name"),requiredString(row,"description"),requiredString(row,"category"),requiredString(row,"provider"),String(row.price),String(row.freePrice),requiredString(row,"currency"),String(row.commissionPct),requiredString(row,"imageColor"),String(row.rating),Boolean(row.popular),requiredString(row,"createdAt")); }
async function importLegacyMarketplaceOrder(row: Record<string, unknown>) { await commerceDb.rawExec(`INSERT INTO marketplace_orders (id,profile_id,product_id,product_name,amount,pricing_tier,commission,status,created_at) VALUES ($1,$2,$3,$4,$5::numeric,$6,$7::numeric,$8,$9::timestamptz) ON CONFLICT (id) DO NOTHING`,requiredString(row,"id"),requiredString(row,"profileId"),requiredString(row,"productId"),requiredString(row,"productName"),String(row.amount),requiredString(row,"pricingTier"),String(row.commission),requiredString(row,"status"),requiredString(row,"createdAt")); }
async function importLegacyMallTransaction(row: Record<string, unknown>) { await commerceDb.rawExec(`INSERT INTO mall_transactions (id,profile_id,nfc_tag_id,store_name,amount,cost_of_sale,vat,share_pool,kasi_pool,status,created_at) VALUES ($1,$2,$3,$4,$5::numeric,$6::numeric,$7::numeric,$8::numeric,$9::numeric,$10,$11::timestamptz) ON CONFLICT (id) DO NOTHING`,requiredString(row,"id"),nullableString(row.profileId),requiredString(row,"nfcTagId"),requiredString(row,"storeName"),String(row.amount),String(row.costOfSale),String(row.vat),String(row.sharePool),String(row.kasiPool),requiredString(row,"status"),requiredString(row,"createdAt")); }
async function importLegacyRootsBankShare(row: Record<string, unknown>) { await commerceDb.rawExec(`INSERT INTO roots_bank_shares (id,profile_id,category,share_price,membership_fee,total_amount,payment_ref,pioneer_pool,status,created_at) VALUES ($1,$2,$3,$4::numeric,$5::numeric,$6::numeric,$7,$8,$9,$10::timestamptz) ON CONFLICT (profile_id) DO UPDATE SET category=EXCLUDED.category,share_price=EXCLUDED.share_price,membership_fee=EXCLUDED.membership_fee,total_amount=EXCLUDED.total_amount,payment_ref=EXCLUDED.payment_ref,pioneer_pool=EXCLUDED.pioneer_pool,status=EXCLUDED.status,created_at=EXCLUDED.created_at`,requiredString(row,"id"),requiredString(row,"profileId"),requiredString(row,"category"),String(row.sharePrice),String(row.membershipFee),String(row.totalAmount),requiredString(row,"paymentRef"),Boolean(row.pioneerPool),requiredString(row,"status"),requiredString(row,"createdAt")); }
async function importLegacyRootsBankDuplicate(row: Record<string, unknown>) { await auditDb.rawExec(`INSERT INTO audit_logs (id,action,entity_type,entity_id,after,created_at) VALUES ($1,'migration.duplicate_roots_bank_registration','profile',$2,$3::jsonb,$4::timestamptz) ON CONFLICT (id) DO NOTHING`,requiredString(row,"auditId"),requiredString(row,"profileId"),JSON.stringify(row),requiredString(row,"createdAt")); }
async function importLegacyReferral(row: Record<string, unknown>) { await engagementDb.rawExec(`INSERT INTO referrals (id,referrer_profile_id,referred_profile_id,referral_code,referred_name,referred_email,referred_mobile,status,reward_amount,created_at,converted_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::numeric,$10::timestamptz,$11::timestamptz) ON CONFLICT (id) DO NOTHING`,requiredString(row,"id"),requiredString(row,"referrerProfileId"),nullableString(row.referredProfileId),requiredString(row,"referralCode"),requiredString(row,"referredName"),requiredString(row,"referredEmail"),requiredString(row,"referredMobile"),requiredString(row,"status"),String(row.rewardAmount),requiredString(row,"createdAt"),nullableString(row.convertedAt)); }
async function importLegacyVoucher(row: Record<string, unknown>) { await engagementDb.rawExec(`INSERT INTO vouchers (id,profile_id,code,title,description,provider,value,category,status,issue_date,expiry_date,anniversary_date,wablast_sent,expiring_sent,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7::numeric,$8,$9,$10::timestamptz,$11::timestamptz,$12::timestamptz,$13,$14,$15::timestamptz) ON CONFLICT (id) DO NOTHING`,requiredString(row,"id"),requiredString(row,"profileId"),requiredString(row,"code"),requiredString(row,"title"),requiredString(row,"description"),requiredString(row,"provider"),String(row.value),requiredString(row,"category"),requiredString(row,"status"),requiredString(row,"issueDate"),requiredString(row,"expiryDate"),nullableString(row.anniversaryDate),Boolean(row.wablastSent),Boolean(row.expiringSent),requiredString(row,"createdAt")); }
async function importLegacySubscriptionNotification(row: Record<string, unknown>) { await engagementDb.rawExec(`INSERT INTO subscription_notifications (id,profile_id,days_before,billing_period,channel,status,message,sent_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::timestamptz) ON CONFLICT (profile_id,days_before,billing_period) DO UPDATE SET channel=EXCLUDED.channel,status=EXCLUDED.status,message=EXCLUDED.message,sent_at=EXCLUDED.sent_at`,requiredString(row,"id"),requiredString(row,"profileId"),Number(row.daysBefore),requiredString(row,"billingPeriod"),requiredString(row,"channel"),requiredString(row,"status"),requiredString(row,"message"),requiredString(row,"sentAt")); }
async function importLegacySetting(row: Record<string, unknown>) { await membershipDb.rawExec(`INSERT INTO business_config_versions (id,config_key,version,effective_from,config) VALUES ($1,$2,1,$3::timestamptz,$4::jsonb) ON CONFLICT (config_key,version) DO UPDATE SET config=EXCLUDED.config,effective_from=EXCLUDED.effective_from`,requiredString(row,"id"),requiredString(row,"key"),requiredString(row,"updatedAt"),JSON.stringify({value:row.value,category:row.category})); }
async function importLegacySilo(row: Record<string, unknown>) { await commerceDb.rawExec(`INSERT INTO silo_config (id,name,percentage,description,color,sort_order,updated_at) VALUES ($1,$2,$3::numeric,$4,$5,$6,$7::timestamptz) ON CONFLICT (name) DO UPDATE SET percentage=EXCLUDED.percentage,description=EXCLUDED.description,color=EXCLUDED.color,sort_order=EXCLUDED.sort_order,updated_at=EXCLUDED.updated_at`,requiredString(row,"id"),requiredString(row,"name"),String(row.percentage),nullableString(row.description),requiredString(row,"color"),Number(row.sortOrder),requiredString(row,"updatedAt")); }
async function importLegacyAuditNotification(row: Record<string, unknown>) { await auditDb.rawExec(`INSERT INTO audit_logs (id,action,entity_type,entity_id,after,created_at) VALUES ($1,'legacy.auditor_notification','profile',$2,$3::jsonb,$4::timestamptz) ON CONFLICT (id) DO NOTHING`,requiredString(row,"id"),requiredString(row,"profileId"),JSON.stringify({monthEarnings:row.monthEarnings,month:row.month,status:row.status}),requiredString(row,"sentAt")); }
async function importLegacyWalletBalance(row: Record<string, unknown>) { await networkDb.rawExec(`INSERT INTO wallets (id,profile_id,currency,status,cached_balance) VALUES ($1,$2,'ZAR','active',$3::numeric) ON CONFLICT (profile_id) DO UPDATE SET cached_balance=EXCLUDED.cached_balance,currency=EXCLUDED.currency,status=EXCLUDED.status`,requiredString(row,"id"),requiredString(row,"profileId"),String(row.balance)); }

function requiredString(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  if (typeof value !== "string" || value.length === 0) throw new Error(`invalid_legacy_field:${key}`);
  return value;
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export const debugMemberState = api<
  { profileId: string },
  {
    wallet: { profile_id: string; currency: string; cached_balance: string } | null;
    matrixNode: {
      id: string;
      profile_id: string;
      parent_node_id: string | null;
      sponsor_profile_id: string | null;
      position_index: number;
      depth: number;
      path: string;
    } | null;
  }
>(
  { method: "GET", path: "/admin/debug/member/:profileId", expose: true },
  async (req) => {
    await requireAdminAccess();
    const wallet = await networkDb.rawQueryRow<{
      profile_id: string;
      currency: string;
      cached_balance: string;
    }>("SELECT profile_id, currency, cached_balance::text AS cached_balance FROM wallets WHERE profile_id = $1 ORDER BY created_at DESC LIMIT 1", req.profileId);
    const matrixNode = await networkDb.rawQueryRow<{
      id: string;
      profile_id: string;
      parent_node_id: string | null;
      sponsor_profile_id: string | null;
      position_index: number;
      depth: number;
      path: string;
    }>("SELECT id, profile_id, parent_node_id, sponsor_profile_id, position_index, depth, path FROM matrix_nodes WHERE profile_id = $1", req.profileId);
    return { wallet, matrixNode };
  },
);






