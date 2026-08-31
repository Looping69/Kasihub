# KaSiShares Presale End-to-End Test Runbook

**Status:** Implemented and locally proven on 2026-08-31
**Scope:** Non-production only
**Production access:** The test APIs return `404` in an Encore production environment. The Next session bridge returns `404` unless Next is running in development mode.

## Latest verified run

Verified locally on 2026-08-31 after the exact-decimal issuance fix:

| Evidence | Result |
| --- | --- |
| Run | `7eb1aa3f-5c70-415c-8f72-b4dfebdb9278` |
| Order | `KSP-69ECFD60-MTH4BRVZ` |
| Purchase | `2979e900-c397-4a46-9018-5b6ddf86a468` |
| Certificate | `SOL-P1-003` |
| Settlement replay | Same purchase and certificate |
| Durable delivery | Outbox processed and inbox completion recorded |
| Holder read model | Allocation shown as issued |
| Integrity | Certificate hash verified |
| PDF | Valid `%PDF-` response, 1,457,808 bytes |

Release gates from the same working tree: lint passed, TypeScript passed, 215/215 root tests passed, coverage passed at 90.38% statements and 72.25% branches, backend strict TypeScript passed, 6/6 backend architecture contracts passed, and the Next production build passed.

## What this test proves

The test drives the real backend and frontend boundaries. It does not use the old read-only preview and it does not require a manually created private link, external KYC decision, card-provider callback, or blockchain transfer.

Each run creates an isolated synthetic applicant and then proves:

1. a private invitation is created and resolved by the real offer API;
2. an approved synthetic KYC case is bound to a presale-scoped identity;
3. the real `/presale/orders` API creates a reservation using its normal validation and idempotency rules;
4. a clearly labelled non-production provider settlement is applied;
5. settlement writes a durable `share_issuance_requested` outbox event;
6. the single `issueShares` authority writes inventory, purchase, range, sequence, sealed certificate and completion event atomically;
7. the completion is consumed into the presale inbox and the order becomes `incorporated`;
8. replaying the settlement returns the same purchase and certificate;
9. the applicant portal shows the allocation as `issued`;
10. public verification recalculates and accepts the certificate integrity hash;
11. the Next applicant BFF sees the same certificate;
12. the holder-authorised certificate route returns a real PDF.

## Run it locally

Terminal 1 - start the isolated Encore runtime and databases:

```powershell
npm run encore:docker
```

Terminal 2 - start Next against that runtime:

```powershell
$env:ENCORE_API_URL = "http://127.0.0.1:4001"
npm run dev
```

Terminal 3 - execute the full proof:

```powershell
npm run test:presale:e2e
```

For a backend-only run when the frontend is deliberately not running:

```powershell
npm run test:presale:e2e:backend
```

## Passing output

A passing run returns JSON with all of these fields set:

```json
{
  "ok": true,
  "settlementReplayIdempotent": true,
  "outboxProcessed": true,
  "portalIssued": true,
  "certificateVerified": true,
  "frontend": {
    "checked": true,
    "pdfBytes": 1000
  }
}
```

The IDs and PDF byte count differ on every run. `pdfBytes` must be greater than 1,000 and the response must begin with `%PDF-`.

## Safety boundary

- Test identities use `@kasihub.test` addresses.
- Test campaigns are marked `is_mock = true` and namespaced with the run UUID.
- KYC evidence is explicitly marked synthetic and non-production.
- Settlement references begin with `E2E-` and never call WebPay, a blockchain provider, or a custody provider.
- The harness cannot run in Encore production.
- The browser session bridge cannot run in a production Next build.
- This test never creates a real payment, real shareholder, or production certificate.

## Failure interpretation

The command stops at the first broken invariant and names the failed boundary. A green frontend build alone is not a pass. A generated PDF alone is not a pass. The run passes only when reservation, durable settlement handoff, authoritative issuance, replay, portfolio, PDF and verification all agree.
