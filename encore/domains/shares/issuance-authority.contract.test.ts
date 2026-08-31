import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const presaleSource = readFileSync("domains/presale/api.ts", "utf8");
const issuanceSource = readFileSync("domains/shares/issuance.ts", "utf8");
const presaleMigration = readFileSync("migrations/presale/16_share_issuance_outbox.up.sql", "utf8");
const sharesMigration = readFileSync("migrations/shares/10_issuance_authority_and_outbox.up.sql", "utf8");

describe("single share issuance authority", () => {
  test("routes individual and batch incorporation through the same command", () => {
    expect(presaleSource.match(/issueShares\(/g)).toHaveLength(1);
    expect(presaleSource).not.toContain("INSERT INTO share_purchases");
    expect(presaleSource).not.toContain("INSERT INTO share_certificates");
    expect(issuanceSource).toContain("INSERT INTO share_purchases");
    expect(issuanceSource).toContain("INSERT INTO share_certificates");
    expect(presaleSource).toContain("incorporateConfirmedPresaleOrder(order.order_reference)");
  });

  test("persists both sides of the durable delivery protocol", () => {
    expect(presaleMigration).toContain("CREATE TABLE presale_outbox");
    expect(presaleMigration).toContain("CREATE TABLE presale_inbox");
    expect(sharesMigration).toContain("CREATE TABLE share_issuance_operations");
    expect(sharesMigration).toContain("CREATE TABLE shares_outbox");
  });

  test("keeps certificate pricing on exact database decimals", () => {
    expect(issuanceSource).toContain("const issuePricePerShare = command.issuePricePerPaidShare");
    expect(issuanceSource).not.toContain("Number(command.acquisitionAmount) / command.paidShares");
    expect(presaleSource).toContain("issuePricePerPaidShare: order.unit_price_usd");
  });
});
