import { describe, expect, test } from "vitest";
import { PDFDocument } from "pdf-lib";
import { generateShareCertificatePdf } from "./share-certificate-pdf";

describe("Solidus shareholder certificate", () => {
  test("generates a complimentary certificate with zero paid shares", async () => {
    const bytes = await generateShareCertificatePdf({ certificateNumber: "GRANT-TEST-001", holderName: "Coupon Recipient", profileNumber: "TEST",
      totalShares: 5, paidShares: 0, bonusShares: 0, complimentaryShares: 5, issuePricePerShare: 0, issuePriceCurrency: "USD",
      issuedAt: "2026-09-05T00:00:00Z", status: "issued" });
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
  }, 30_000);
  test("generates an A4 landscape certificate from authoritative register data", async () => {
    const bytes = await generateShareCertificatePdf({
      certificateNumber: "CERT-TEST-001",
      holderName: "Test Shareholder",
      holderAddress: "1 Test Street, Johannesburg, 2001, South Africa",
      profileNumber: "KSI-TEST",
      orderReference: "KSH-TEST-001",
      totalShares: 10,
      paidShares: 5,
      bonusShares: 5,
      distinctiveFrom: 1,
      distinctiveTo: 10,
      issuePricePerShare: 25,
      issuePriceCurrency: "USD",
      issuedAt: "2026-08-29T08:00:00.000Z",
      status: "issued",
      verificationId: "57ca0d58-fcdf-4d35-b350-8e040248e63f",
      integrityHash: "7f".repeat(32),
    });

    const document = await PDFDocument.load(bytes);
    expect(document.getPageCount()).toBe(1);
    expect(document.getTitle()).toBe("CERT-TEST-001 - Solidus Holdings Share Certificate");
    expect(document.getAuthor()).toBe("Solidus Holdings (Pty) Ltd");
    expect(document.getKeywords()).toContain(`integrity-sha256:${"7f".repeat(32)}`);
    const { width, height } = document.getPage(0).getSize();
    expect(width).toBeCloseTo(841.89, 1);
    expect(height).toBeCloseTo(595.28, 1);
  }, 20_000);

  test("rejects an issue price without its currency", async () => {
    await expect(generateShareCertificatePdf({
      certificateNumber: "SOL-P1-001",
      holderName: "Test Shareholder",
      profileNumber: "KSI-TEST",
      totalShares: 20,
      issuePricePerShare: 25,
      issuedAt: "2026-08-29T08:00:00.000Z",
      status: "issued",
    })).rejects.toThrow("incomplete_issue_price");
  });

  test("rejects a distinctive range that does not equal the issued total", async () => {
    await expect(generateShareCertificatePdf({
      certificateNumber: "SOL-P1-001",
      holderName: "Test Shareholder",
      profileNumber: "KSI-TEST",
      totalShares: 20,
      distinctiveFrom: 1,
      distinctiveTo: 10,
      issuedAt: "2026-08-29T08:00:00.000Z",
      status: "issued",
    })).rejects.toThrow("invalid_distinctive_range");
  });

  test("rejects a paid and bonus allocation that does not match the issued total", async () => {
    await expect(generateShareCertificatePdf({
      certificateNumber: "CERT-TEST-002",
      holderName: "Test Shareholder",
      profileNumber: "KSI-TEST",
      totalShares: 10,
      paidShares: 5,
      bonusShares: 4,
      issuedAt: "2026-08-29T08:00:00.000Z",
      status: "issued",
    })).rejects.toThrow("share_allocation_mismatch");
  });
});
