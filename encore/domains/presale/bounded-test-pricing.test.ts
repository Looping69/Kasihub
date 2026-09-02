// Author: Klaasvaakie ( |╲ )
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const apiPath = fileURLToPath(new URL("./api.ts", import.meta.url));
const migrationPath = fileURLToPath(new URL("../../migrations/presale/17_bounded_crypto_test_pricing.up.sql", import.meta.url));
const activePricingMigrationPath = fileURLToPath(new URL("../../migrations/presale/20_disable_active_test_pricing.up.sql", import.meta.url));

describe("bounded presale test pricing", () => {
  test("adds an independently bounded crypto settlement window", () => {
    const sql = readFileSync(migrationPath, "utf8");
    expect(sql).toContain("crypto_test_unit_price_usdt numeric(20,6)");
    expect(sql).toContain("crypto_test_orders_remaining integer NOT NULL DEFAULT 0");
    expect(sql).toContain("crypto_test_price_applied boolean NOT NULL DEFAULT false");
    expect(sql).toContain("presale_campaigns_crypto_test_price_check");
  });

  test("consumes one rail-specific slot and restores it on cancellation or expiry", () => {
    const source = readFileSync(apiPath, "utf8").replace(/\r\n/g, "\n");
    expect(source).toContain("crypto_test_orders_remaining = crypto_test_orders_remaining - $4");
    expect(source).toContain("crypto_test_price_applied = $6");
    expect(source).toContain("AS crypto_payment_unit_price_usdt");
    expect(source.match(/crypto_test_orders_remaining = crypto_test_orders_remaining \+ \$4/g)).toHaveLength(2);
    expect(source).toContain("order.crypto_test_price_applied ? 1 : 0");
    expect(source).toContain("row.crypto_test_price_applied ? 1 : 0");
  });

  test("normalizes legacy active campaigns before enforcing real pricing", () => {
    const sql = readFileSync(activePricingMigrationPath, "utf8");
    const updateIndex = sql.indexOf("UPDATE presale_campaigns");
    const constraintIndex = sql.indexOf("ADD CONSTRAINT presale_active_campaign_has_real_pricing");

    expect(updateIndex).toBeGreaterThan(-1);
    expect(constraintIndex).toBeGreaterThan(updateIndex);
    expect(sql).toContain("WHERE status = 'active'");
    expect(sql).toContain("webpay_test_unit_price_zar = NULL");
    expect(sql).toContain("crypto_test_unit_price_usdt = NULL");
  });
});
