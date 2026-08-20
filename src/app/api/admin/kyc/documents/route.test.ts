// Author: Klaasvaakie ( |╲ )
import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ encoreRequest: vi.fn(), encoreSessionToken: vi.fn() }));

vi.mock("@/lib/encore-client", () => {
  class EncoreRequestError extends Error {
    constructor(message: string, public status: number, public details: unknown = null) { super(message); }
  }
  return { EncoreRequestError, encoreRequest: mocks.encoreRequest, encoreSessionToken: mocks.encoreSessionToken };
});

import { GET, PATCH } from "./route";

function request(path: string, init: RequestInit = {}) {
  return new NextRequest(`https://kasihub.test${path}`, init as ConstructorParameters<typeof NextRequest>[1]);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.encoreSessionToken.mockResolvedValue("admin-token");
  mocks.encoreRequest.mockResolvedValue({ documents: [] });
});

describe("admin KYC evidence BFF", () => {
  test("lists a member's private evidence through the admin session", async () => {
    const response = await GET(request("/api/admin/kyc/documents?memberId=profile%2F1"));
    expect(response.status).toBe(200);
    expect(mocks.encoreRequest).toHaveBeenCalledWith(
      "/admin/kyc/international/profiles/profile%2F1/documents",
      {},
      "admin-token",
    );
  });

  test("reviews an exact document and requires a rejection reason", async () => {
    const rejected = await PATCH(request("/api/admin/kyc/documents", {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ documentId: "document-1", action: "REJECT" }),
    }));
    expect(rejected.status).toBe(400);
    expect(mocks.encoreRequest).not.toHaveBeenCalled();

    await PATCH(request("/api/admin/kyc/documents", {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ documentId: "document/1", action: "APPROVE" }),
    }));
    expect(mocks.encoreRequest).toHaveBeenCalledWith(
      "/admin/kyc/international/documents/document%2F1/review",
      { method: "POST", body: JSON.stringify({ action: "APPROVE", reason: undefined }) },
      "admin-token",
    );
  });

  test("fails closed without an admin session", async () => {
    mocks.encoreSessionToken.mockResolvedValue(undefined);
    expect((await GET(request("/api/admin/kyc/documents?memberId=profile"))).status).toBe(401);
    expect(mocks.encoreRequest).not.toHaveBeenCalled();
  });
});
