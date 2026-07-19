// Author: Klaasvaakie ( |╲ )
import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  encoreRequest: vi.fn(),
  encoreSessionToken: vi.fn(),
}));

vi.mock("@/lib/encore-client", () => {
  class EncoreRequestError extends Error {
    constructor(message: string, public status: number, public details: unknown = null) { super(message); }
  }
  return {
    ENCORE_SESSION_COOKIE: "kasihub_session",
    EncoreRequestError,
    encoreRequest: mocks.encoreRequest,
    encoreSessionToken: mocks.encoreSessionToken,
  };
});

import { GET as listOperations, POST as retryOperation } from "./admin/operations/route";
import { GET as listFindings, POST as reconcile } from "./admin/reconciliation/route";

function get(path: string) { return new NextRequest(`https://kasihub.test${path}`); }
function post(path: string, body: unknown) {
  return new NextRequest(`https://kasihub.test${path}`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.encoreSessionToken.mockResolvedValue("admin-token");
});

describe("administrator workflow routes", () => {
  test.each([
    ["operations", listOperations, "/api/admin/operations?state=failed"],
    ["findings", listFindings, "/api/admin/reconciliation?state=open"],
  ])("%s listing requires a session", async (_name, handler, path) => {
    mocks.encoreSessionToken.mockResolvedValue(undefined);
    expect((await handler(get(path))).status).toBe(401);
  });

  test("lists operations with the original query", async () => {
    mocks.encoreRequest.mockResolvedValue({ operations: [{ id: "operation" }] });
    const response = await listOperations(get("/api/admin/operations?state=failed&limit=5"));
    expect(await response.json()).toEqual({ operations: [{ id: "operation" }] });
    expect(mocks.encoreRequest).toHaveBeenCalledWith("/admin/operations?state=failed&limit=5", {}, "admin-token");
  });

  test("validates and forwards operation retries", async () => {
    expect((await retryOperation(post("/api/admin/operations", {}))).status).toBe(400);
    mocks.encoreRequest.mockResolvedValue({ operationId: "operation", status: "completed" });
    const response = await retryOperation(post("/api/admin/operations", { operationId: "operation/id" }));
    expect(response.status).toBe(200);
    expect(mocks.encoreRequest).toHaveBeenCalledWith("/admin/operations/operation%2Fid/retry", { method: "POST" }, "admin-token");
  });

  test("starts reconciliation and resolves explicit findings", async () => {
    mocks.encoreRequest.mockResolvedValueOnce({ runId: "run", findings: 0 });
    expect(await (await reconcile(post("/api/admin/reconciliation", {}))).json()).toMatchObject({ runId: "run" });
    expect(mocks.encoreRequest).toHaveBeenLastCalledWith("/admin/reconciliation/runs", { method: "POST" }, "admin-token");

    mocks.encoreRequest.mockResolvedValueOnce({ findingId: "finding", state: "resolved" });
    const response = await reconcile(post("/api/admin/reconciliation", {
      findingId: "finding/id", resolution: "Verified", state: "resolved",
    }));
    expect(response.status).toBe(200);
    expect(mocks.encoreRequest).toHaveBeenLastCalledWith(
      "/admin/reconciliation/findings/finding%2Fid/resolve",
      { method: "POST", body: JSON.stringify({ resolution: "Verified", state: "resolved" }) },
      "admin-token",
    );
  });

  test("preserves Encore authorization and conflict status codes", async () => {
    const { EncoreRequestError } = await import("@/lib/encore-client");
    mocks.encoreRequest.mockRejectedValue(new EncoreRequestError("forbidden", 403, null));
    expect((await listOperations(get("/api/admin/operations"))).status).toBe(403);
    expect((await reconcile(post("/api/admin/reconciliation", {}))).status).toBe(403);
  });
});
