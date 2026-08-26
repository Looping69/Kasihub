import { beforeEach, describe, expect, test, vi } from "vitest";
import { PDFDocument } from "pdf-lib";

const mocks = vi.hoisted(() => ({ encoreRequest: vi.fn(), presaleSessionToken: vi.fn() }));
vi.mock("@/lib/encore-client", () => {
  class EncoreRequestError extends Error {
    constructor(message: string, public status: number, public details: unknown = null) { super(message); }
  }
  return { EncoreRequestError, encoreRequest: mocks.encoreRequest, presaleSessionToken: mocks.presaleSessionToken };
});

import { GET } from "./[certificateNumber]/route";

const context = (certificateNumber: string) => ({ params: Promise.resolve({ certificateNumber }) });

describe("presale shareholder certificate PDF", () => {
  beforeEach(() => {
    mocks.encoreRequest.mockReset();
    mocks.presaleSessionToken.mockReset();
  });

  test("fails closed without a KaSiShares session", async () => {
    mocks.presaleSessionToken.mockResolvedValue(null);
    const response = await GET(new Request("http://localhost"), context("CERT-1"));
    expect(response.status).toBe(401);
    expect(mocks.encoreRequest).not.toHaveBeenCalled();
  });

  test("generates the signed-in shareholder's campaign certificate", async () => {
    mocks.presaleSessionToken.mockResolvedValue("presale-token");
    mocks.encoreRequest.mockResolvedValue({
      applicant: { profileNumber: "KSI-1", legalName: "Test Holder" },
      shareholder: { holdings: [{
        campaignName: "Test Campaign", paidShares: 2, bonusShares: 2,
        certificate: { certificateNumber: "CERT-1", totalShares: 4, status: "issued", issuedAt: "2026-08-26T00:00:00Z" },
      }] },
    });
    const response = await GET(new Request("http://localhost"), context("CERT-1"));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(mocks.encoreRequest).toHaveBeenCalledWith("/presale/applicant/portal", {}, "presale-token");
    expect((await PDFDocument.load(await response.arrayBuffer())).getPageCount()).toBe(1);
  });

  test("does not expose another shareholder's certificate", async () => {
    mocks.presaleSessionToken.mockResolvedValue("presale-token");
    mocks.encoreRequest.mockResolvedValue({ applicant: { profileNumber: "KSI-1", legalName: "Test Holder" }, shareholder: { holdings: [] } });
    const response = await GET(new Request("http://localhost"), context("CERT-OTHER"));
    expect(response.status).toBe(404);
  });
});
