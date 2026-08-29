import { describe, expect, test } from "vitest";
import { PDFDocument } from "pdf-lib";
import { generateShareCertificatePdf } from "./share-certificate-pdf";

describe("Solidus shareholder certificate", () => {
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
      issuedAt: "2026-08-29T08:00:00.000Z",
      status: "issued",
    });

    const document = await PDFDocument.load(bytes);
    expect(document.getPageCount()).toBe(1);
    expect(document.getTitle()).toBe("CERT-TEST-001 - Solidus Holdings Share Certificate");
    expect(document.getAuthor()).toBe("Solidus Holdings (Pty) Ltd");
    const { width, height } = document.getPage(0).getSize();
    expect(width).toBeCloseTo(841.89, 1);
    expect(height).toBeCloseTo(595.28, 1);
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
