// Author: Klaasvaakie ( |╲ )
import { api } from "encore.dev/api";
import { createHash, timingSafeEqual } from "node:crypto";
import { diagnoseRemitanoCredentials } from "./custody";

const ONE_TIME_TOKEN_HASH = "c8b5b7816260e279e5e350a631ca1e0eb4da9029ee7710f93b7c873be4b2932a";

function authorized(value: string | string[] | undefined): boolean {
  const supplied = createHash("sha256").update(Array.isArray(value) ? value[0] ?? "" : value ?? "").digest();
  const expected = Buffer.from(ONE_TIME_TOKEN_HASH, "hex");
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

// One-time production credential probe. This endpoint is removed immediately
// after the authenticated diagnostic completes.
export const remitanoDiagnostic = api.raw(
  { expose: true, method: "POST", path: "/internal/payments/remitano-diagnostic" },
  async (req, res) => {
    if (!authorized(req.headers["x-diagnostic-token"])) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false }));
      return;
    }
    try {
      await diagnoseRemitanoCredentials();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, authorized: true }));
    } catch (error) {
      res.writeHead(503, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, reason: error instanceof Error ? error.message : "provider_unavailable" }));
    }
  },
);
