import { beforeEach, describe, expect, test, vi } from "vitest";
import { PDFDocument } from "pdf-lib";

const mocks = vi.hoisted(() => ({ encoreRequest: vi.fn(), encoreSessionToken: vi.fn() }));

vi.mock("@/lib/encore-client", () => {
  class EncoreRequestError extends Error {
    constructor(message: string, public status: number, public details: unknown = null) { super(message); }
  }
  return { EncoreRequestError, encoreRequest: mocks.encoreRequest, encoreSessionToken: mocks.encoreSessionToken };
});

import { GET } from "./[certificateNumber]/route";

const context = (certificateNumber: string) => ({ params: Promise.resolve({ certificateNumber }) });

describe("member share certificate PDF", () => {
  beforeEach(() => {
    mocks.encoreRequest.mockReset();
    mocks.encoreSessionToken.mockReset();
  });

  test("fails closed without an authenticated Encore session", async () => {
    mocks.encoreSessionToken.mockResolvedValue(null);
    const response = await GET(new Request("http://localhost/api/shares/certificates/CERT-1"), context("CERT-1"));
    expect(response.status).toBe(401);
    expect(mocks.encoreRequest).not.toHaveBeenCalled();
  });

  test("generates a one-page PDF only from the signed-in member's certificate record", async () => {
    mocks.encoreSessionToken.mockResolvedValue("member-token");
    mocks.encoreRequest
      .mockResolvedValueOnce({ member: { id: "profile-1", profileNumber: "KSH-0001", firstName: "Wimpie", lastName: "van Loggerenberg", companyName: null } })
      .mockResolvedValueOnce({ certificates: [{ certificateNumber: "CERT-PRESALE-ORDER-1", totalShares: 20, status: "issued", issuedAt: "2026-08-21T00:00:00.000Z", revokedAt: null, issuePricePerShare: 25, issuePriceCurrency: "USD" }] });

    const response = await GET(new Request("http://localhost/api/shares/certificates/CERT-PRESALE-ORDER-1"), context("CERT-PRESALE-ORDER-1"));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toContain("CERT-PRESALE-ORDER-1.pdf");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(mocks.encoreRequest).toHaveBeenNthCalledWith(2, "/shares/me/profile-1", {}, "member-token");
    const pdf = await PDFDocument.load(await response.arrayBuffer());
    expect(pdf.getPageCount()).toBe(1);
    expect(pdf.getTitle()).toContain("CERT-PRESALE-ORDER-1");
  });

  test("does not generate a PDF for a certificate outside the signed-in member's holdings", async () => {
    mocks.encoreSessionToken.mockResolvedValue("member-token");
    mocks.encoreRequest
      .mockResolvedValueOnce({ member: { id: "profile-1", profileNumber: "KSH-0001", firstName: "Wimpie", lastName: "van Loggerenberg", companyName: null } })
      .mockResolvedValueOnce({ certificates: [] });
    const response = await GET(new Request("http://localhost/api/shares/certificates/CERT-OTHER"), context("CERT-OTHER"));
    expect(response.status).toBe(404);
  });
});
