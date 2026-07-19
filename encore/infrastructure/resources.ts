// Author: Klaasvaakie ( |╲ )
import { SQLDatabase } from "encore.dev/storage/sqldb";
import { Bucket } from "encore.dev/storage/objects";

export const identityDb = new SQLDatabase("identity", { migrations: { path: "../migrations/identity" } });
export const membershipDb = new SQLDatabase("membership", { migrations: { path: "../migrations/membership" } });
export const networkDb = new SQLDatabase("network", { migrations: { path: "../migrations/network" } });
export const financeDb = new SQLDatabase("finance", { migrations: { path: "../migrations/finance" } });
export const kycDb = new SQLDatabase("kyc", { migrations: { path: "../migrations/kyc" } });
export const sharesDb = new SQLDatabase("shares", { migrations: { path: "../migrations/shares" } });
export const commerceDb = new SQLDatabase("commerce", { migrations: { path: "../migrations/commerce" } });
export const engagementDb = new SQLDatabase("engagement", { migrations: { path: "../migrations/engagement" } });
export const auditDb = new SQLDatabase("audit", { migrations: { path: "../migrations/audit" } });

export const documentsBucket = new Bucket("documents", { public: false });
