// Author: Klaasvaakie ( |╲ )
import { createHash, createHmac } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

const apply = process.argv.includes("--apply");
const databasePath = process.argv.find((argument) => argument.endsWith(".db")) ?? "db/custom.db";
const database = new DatabaseSync(databasePath, { readOnly: true });
const read = (table) => database.prepare(`SELECT * FROM "${table}"`).all();
const raw = Object.fromEntries([
  "Member","SharePhase","MatrixNode","Subscription","Transaction","Share","AureusShare",
  "DividendDeclaration","KasiPoolDistribution","MarketplaceProduct","MarketplaceOrder","MallTransaction",
  "RootsBankShare","Referral","Voucher","SubscriptionNotification","Setting","SiloConfig","AuditorNotification",
].map((table) => [table, read(table)]));
database.close();

const profileId = (id) => deterministicUuid("profile", id);
const memberByNfc = new Map(raw.Member.filter((row) => row.nfcTagId).map((row) => [row.nfcTagId, row.id]));
const matrixById = new Map(raw.MatrixNode.map((row) => [row.id, row]));
const matrixPath = (row, seen = new Set()) => {
  if (!row.parentId) return String(row.nodeIndex);
  if (seen.has(row.id)) throw new Error(`Matrix cycle detected at ${row.id}`);
  const parent = matrixById.get(row.parentId);
  return parent ? `${matrixPath(parent, new Set([...seen, row.id]))}.${row.position}` : String(row.nodeIndex);
};
const phaseIds = new Map(raw.SharePhase.map((row) => [Number(row.phase), deterministicUuid("share-phase", row.id)]));
const walletBalances = new Map(raw.Member.map((row) => [row.id, 0]));
for (const row of raw.Transaction) walletBalances.set(row.memberId, (walletBalances.get(row.memberId) ?? 0) + Number(row.amount));
const knownProductIds = new Set(raw.MarketplaceProduct.map((row) => row.id));
const recoveredProducts = [...new Map(raw.MarketplaceOrder
  .filter((row) => !knownProductIds.has(row.productId))
  .map((row) => [row.productId, {
    id: row.productId,
    name: row.productName,
    description: "Recovered from a legacy marketplace order whose product catalogue row was missing.",
    category: "LEGACY",
    provider: "KaSiHub Legacy",
    price: row.amount,
    freePrice: row.amount,
    currency: "ZAR",
    commissionPct: 0,
    imageColor: "slate",
    rating: 0,
    popular: false,
    createdAt: row.createdAt,
  }])).values()];
const rootsByMember = new Map();
const duplicateRoots = [];
for (const row of [...raw.RootsBankShare].sort((left, right) => Number(left.createdAt) - Number(right.createdAt))) {
  if (rootsByMember.has(row.memberId)) duplicateRoots.push(row);
  else rootsByMember.set(row.memberId, row);
}

const datasets = [
  ["Member", raw.Member.map((row) => ({...row,id:profileId(row.id),userId:deterministicUuid("user",row.id),password:temporaryPassword(process.env.LEGACY_PASSWORD_SEED ?? "dry-run-seed-that-is-never-used-live",row.email),profileType:profileType(row.membershipType),profileStatus:row.kycStatus==="VERIFIED"?"active":row.kycStatus==="REJECTED"?"rejected":"pending",createdAt:isoDate(row.createdAt),updatedAt:isoDate(row.updatedAt),kycVerifiedAt:optionalIsoDate(row.kycVerifiedAt),instapayVerifiedAt:optionalIsoDate(row.instapayVerifiedAt),taxThreshold:Boolean(row.taxThreshold),uplineConfirmed:Boolean(row.uplineConfirmed),isAdmin:Boolean(row.isAdmin)}))],
  ["SharePhase", raw.SharePhase.map((row) => ({...row,id:deterministicUuid("share-phase",row.id),createdAt:isoDate(row.createdAt),updatedAt:isoDate(row.updatedAt),bonusBuyOneGet:Boolean(row.bonusBuyOneGet)}))],
  ["MarketplaceProduct", [...raw.MarketplaceProduct, ...recoveredProducts].map((row) => ({...row,id:deterministicUuid("product",row.id),createdAt:isoDate(row.createdAt),popular:Boolean(row.popular)}))],
  ["SiloConfig", raw.SiloConfig.map((row) => ({...row,id:deterministicUuid("silo",row.id),updatedAt:isoDate(row.updatedAt)}))],
  ["Setting", raw.Setting.map((row) => ({...row,id:deterministicUuid("setting",row.id),updatedAt:isoDate(row.updatedAt)}))],
  ["MatrixNode", raw.MatrixNode.map((row) => ({...row,id:deterministicUuid("matrix",row.id),profileId:profileId(row.memberId),parentNodeId:row.parentId?deterministicUuid("matrix",row.parentId):null,sponsorProfileId:row.sponsorId?profileId(row.sponsorId):null,path:matrixPath(row),createdAt:isoDate(row.createdAt)}))],
  ["Subscription", raw.Subscription.map((row) => ({...row,id:deterministicUuid("subscription",row.id),profileId:profileId(row.memberId),planId:deterministicUuid("plan",`${row.currency}:${row.amount}`),planCode:`LEGACY-${row.currency}-${row.amount}`,paymentId:deterministicUuid("subscription-payment",row.id),periodEnd:periodEnd(row.period),createdAt:isoDate(row.createdAt)}))],
  ["Share", raw.Share.map((row) => ({...row,id:deterministicUuid("share-purchase",row.id),certificateId:deterministicUuid("share-certificate",row.id),profileId:profileId(row.memberId),phaseId:phaseIds.get(Number(row.phase))??deterministicUuid("share-phase-number",row.phase),createdAt:isoDate(row.createdAt)}))],
  ["AureusShare", raw.AureusShare.map((row) => ({...row,id:deterministicUuid("aureus",row.id),profileId:profileId(row.memberId),createdAt:isoDate(row.createdAt)}))],
  ["MarketplaceOrder", raw.MarketplaceOrder.map((row) => ({...row,id:deterministicUuid("marketplace-order",row.id),profileId:profileId(row.memberId),productId:deterministicUuid("product",row.productId),createdAt:isoDate(row.createdAt)}))],
  ["MallTransaction", raw.MallTransaction.map((row) => ({...row,id:deterministicUuid("mall-transaction",row.id),profileId:memberByNfc.has(row.nfcTagId)?profileId(memberByNfc.get(row.nfcTagId)):null,createdAt:isoDate(row.createdAt)}))],
  ["RootsBankShare", [...rootsByMember.values()].map((row) => ({...row,id:deterministicUuid("roots-bank",row.id),profileId:profileId(row.memberId),paymentRef:row.paymentRef||`legacy:${row.id}`,pioneerPool:Boolean(row.pioneerPool),createdAt:isoDate(row.createdAt)}))],
  ["RootsBankDuplicate", duplicateRoots.map((row) => ({...row,auditId:deterministicUuid("roots-bank-duplicate",row.id),profileId:profileId(row.memberId),createdAt:isoDate(row.createdAt)}))],
  ["Referral", raw.Referral.map((row) => ({...row,id:deterministicUuid("referral",row.id),referrerProfileId:profileId(row.referrerId),referredProfileId:row.referredId?profileId(row.referredId):null,createdAt:isoDate(row.createdAt),convertedAt:optionalIsoDate(row.convertedAt)}))],
  ["Voucher", raw.Voucher.map((row) => ({...row,id:deterministicUuid("voucher",row.id),profileId:profileId(row.memberId),issueDate:isoDate(row.issueDate),expiryDate:isoDate(row.expiryDate),anniversaryDate:optionalIsoDate(row.anniversaryDate),createdAt:isoDate(row.createdAt),wablastSent:Boolean(row.wablastSent),expiringSent:Boolean(row.expiringSent)}))],
  ["SubscriptionNotification", raw.SubscriptionNotification.map((row) => ({...row,id:deterministicUuid("subscription-notification",row.id),profileId:profileId(row.memberId),billingPeriod:new Date(row.sentAt).toISOString().slice(0,7),sentAt:isoDate(row.sentAt)}))],
  ["DividendDeclaration", raw.DividendDeclaration.map((row) => ({...row,id:deterministicUuid("dividend",row.id),declaredAt:isoDate(row.declaredAt),paidAt:optionalIsoDate(row.paidAt)}))],
  ["KasiPoolDistribution", raw.KasiPoolDistribution.map((row) => ({...row,id:deterministicUuid("pool-distribution",row.id),batchId:deterministicUuid("pool-batch",`${row.payoutDate}:${row.source}:${row.poolType}`),profileId:profileId(row.memberId),payoutDate:isoDate(row.payoutDate)}))],
  ["AuditorNotification", raw.AuditorNotification.map((row) => ({...row,id:deterministicUuid("auditor-notification",row.id),profileId:profileId(row.memberId),sentAt:isoDate(row.sentAt)}))],
  ["Transaction", raw.Transaction.map((row) => ({...row,id:deterministicUuid("transaction",row.id),profileId:profileId(row.memberId),memberAccountId:deterministicUuid("ledger-account",row.memberId),systemAccountId:deterministicUuid("ledger-account","legacy-offset"),systemOwnerId:deterministicUuid("ledger-owner","legacy-offset"),memberEntryId:deterministicUuid("ledger-entry-member",row.id),systemEntryId:deterministicUuid("ledger-entry-system",row.id),createdAt:isoDate(row.createdAt)}))],
  ["WalletBalance", [...walletBalances].map(([memberId,balance]) => ({id:deterministicUuid("wallet",memberId),profileId:profileId(memberId),balance:Number(balance.toFixed(2))}))],
];

const summary={databasePath,mode:apply?"apply":"dry-run",entities:Object.fromEntries(datasets.map(([name,rows])=>[name,rows.length])),total:datasets.reduce((sum,[,rows])=>sum+rows.length,0)};
process.stdout.write(`${JSON.stringify(summary,null,2)}\n`);
if(!apply){process.stdout.write("Dry run only. Add --apply and the required migration environment variables to import.\n");process.exit(0);}

const apiUrl=requiredEnvironment("ENCORE_API_URL").replace(/\/$/,"");
const adminEmail=requiredEnvironment("MIGRATION_ADMIN_EMAIL"); const adminPassword=requiredEnvironment("MIGRATION_ADMIN_PASSWORD");
const passwordSeed=requiredEnvironment("LEGACY_PASSWORD_SEED"); if(passwordSeed.length<32)throw new Error("LEGACY_PASSWORD_SEED must contain at least 32 characters");
// Rebuild member passwords after validating the real secret.
for(const row of datasets[0][1]) row.password=temporaryPassword(passwordSeed,row.email);
let token; try{token=await login(adminEmail,adminPassword);}catch{const registration=await request("/auth/register",{method:"POST",body:JSON.stringify({email:adminEmail,password:adminPassword,profileType:"individual",firstName:"Migration",surname:"Administrator",country:"ZA"})});if(!registration.user?.profileId)throw new Error("Failed to create migration administrator");token=await login(adminEmail,adminPassword);}
await request("/migration/bootstrap-admin",{method:"POST"},token);
for(const [entity,rows] of datasets){let imported=0;for(let index=0;index<rows.length;index+=50){const result=await request("/admin/migration/import",{method:"POST",body:JSON.stringify({entity,rows:rows.slice(index,index+50)})},token);imported+=Number(result.imported??0);process.stdout.write(`Imported ${entity}: ${imported}/${rows.length}\n`);}}
process.stdout.write("Legacy import complete.\n");

async function login(email,password){const result=await request("/auth/login",{method:"POST",body:JSON.stringify({email,password})});if(typeof result.token!=="string")throw new Error("Encore login did not return a token");return result.token;}
async function request(path,init,bearerToken){const headers=new Headers(init.headers);headers.set("Accept","application/json");if(init.body)headers.set("Content-Type","application/json");if(bearerToken)headers.set("Authorization",`Bearer ${bearerToken}`);const response=await fetch(`${apiUrl}${path}`,{...init,headers});const text=await response.text();const payload=text?JSON.parse(text):{};if(!response.ok)throw new Error(`${path} failed with ${response.status}: ${text}`);return payload;}
function deterministicUuid(namespace,legacyId){const bytes=createHash("sha256").update(`kasihub:${namespace}:${legacyId}`).digest().subarray(0,16);bytes[6]=(bytes[6]&0x0f)|0x50;bytes[8]=(bytes[8]&0x3f)|0x80;const hex=bytes.toString("hex");return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;}
function temporaryPassword(seed,email){return `K!${createHmac("sha256",seed).update(String(email).toLowerCase()).digest("base64url").slice(0,30)}a1`;}
function profileType(type){if(["COMPANY","SOLE_PROPRIETOR","NPO_NGO"].includes(type))return "company";if(type==="INDIVIDUAL_KIDS")return "minor";return "individual";}
function isoDate(value){const date=new Date(value);if(Number.isNaN(date.getTime()))throw new Error(`Invalid legacy date: ${value}`);return date.toISOString();}
function optionalIsoDate(value){return value?isoDate(value):null;}
function periodEnd(period){const match=/^(\d{4})-(\d{2})$/.exec(String(period));if(!match)return null;return new Date(Date.UTC(Number(match[1]),Number(match[2]),1)).toISOString();}
function requiredEnvironment(name){const value=process.env[name];if(!value)throw new Error(`${name} is required with --apply`);return value;}
