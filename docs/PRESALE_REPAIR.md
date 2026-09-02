# KaSiShares Presale Repair

Updated 2026-09-02. Scope: applicant presale, shared payment verification, WebPay and authoritative presale issuance only.

| Severity | Previous problem | Implemented solution | Files/tests | External dependency |
| --- | --- | --- | --- | --- |
| Critical | Remitano custody was unconditionally bypassed. | Removed bypass; outage is retryable; contradiction is manual review; custody success is required. | payment verification/custody; backend policy tests | Valid Remitano credentials/provider. |
| Critical | Order credential alone authorized private actions. | Order read, proof and checkout require session owner plus credential. Recheck, cancellation, portal, application, KYC and certificate routes bind to authenticated profile. | presale API; 51 route/ownership contracts | None. |
| Critical | Server detection time could decide payment lateness. | BSC obtains canonical block time, persists it and compares it with the locked deadline. Missing time fails to review. | chain provider/types/evaluator; payments migration 6; four deadline tests | Trustworthy BSC RPC. |
| Critical | Late/cancelled/expired money could issue shares. | Evidence enters `manual_review`; allocation and issuance are untouched. On-time mining is not penalized for later confirmation. | presale API; migration 19; late-payment contracts | Encore DB execution proof. |
| Critical | Admin override created paid ownership without settlement. | Authority disabled; Encore endpoint, Next proxy and admin button removed. Historical records remain visible. | presale API/admin UI; negative override test | None. |
| High | Modules interpreted lifecycle independently. | Existing applicant journey is canonical and now declares legal successors, actors, evidence, reversibility and terminality. Critical mutations assert transitions; frontend consumes server authority. | applicant journey/API; 57 backend policy tests | None. |
| High | WebPay references could be replayed. | Existing identity/checksum/order/amount/currency/method checks retained; durable unique provider-reference and order claim precedes fulfilment. | presale API; migration 22; WebPay contracts | Live callback rehearsal. |
| High | Audit mechanisms were fragmented. | Existing payment history, custody evidence and issuance outboxes retained; migration 21 emits non-secret lifecycle events and migration 19 records late-payment evidence. | migrations 19/21 | Apply migrations. |
| High | Active financial behavior could use test prices or missing secrets. | Activation validates BSC, Remitano, WebPay, webhook, encryption and email configuration. Migration 20 rejects active test pricing; mock campaigns remain rejected. | API/provider validators/migration 20 | Supply and verify real configuration. |
| High | Duplicate workers could double allocate or issue. | Existing row locks, conditional inventory updates, unique hashes/events, outbox/inbox, unique issuance operations/source references, atomic share ranges and certificate transaction remain authoritative. | fulfilment/issuance integration suites | Native Encore DB runtime. |

## Configuration

Activation fails closed unless these are structurally valid: `BscRpcUrl`, `REMITANO_API_KEY`, `REMITANO_SECRET_KEY`, `PresaleWebhookSecret`, `InvestorApplicationEncryptionKey`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `WEBPAY_MERCHANT_UUID`, `WEBPAY_ACCOUNT_UUID`, `WEBPAY_SECURITY_KEY`, `WEBPAY_CHECKOUT_URL`, `WEBPAY_NOTIFY_URL`, `WEBPAY_SITE_ID`. Values are never logged. The active receiving record must independently match BSC, USDT contract, address, confirmation depth, provider and custody policy.

Expiry, crypto retry, incorporation and email retry jobs exist; deployed schedules remain an external release check.

## Verification

- Frontend/server contracts: 51 passed.
- Backend pure policy suite: 57 passed.
- TypeScript and production build: passed.
- `encore test` from `encore/`: `starting daemon: timed out waiting for daemon to start`.
- Direct DB/runtime suite: `ENCORE_RUNTIME_LIB environment variable is not set`.

The native blocker is environmental: the daemon fails before parsing or executing this repair. Migrations and DB concurrency suites must run in CI or a correctly installed Encore environment before deployment.

## Readiness

| Gate | Status |
| --- | --- |
| Financial integrity | PASS — DB execution remains a release gate. |
| Applicant authorization | PASS |
| Crypto verification | PASS |
| Custody reconciliation | PASS in code; live provider external |
| WebPay verification | PASS in code; live callback external |
| Allocation concurrency | PASS in code; native DB suite external |
| Settlement idempotency | PASS |
| Share issuance idempotency | PASS |
| Late payment policy | PASS |
| Production configuration | BLOCKED — real values/services unverified |

Controlled-test ready: **YES**, after applying migrations in an isolated non-production Encore environment. Missing financial configuration fails closed and no test requires real investor money.

Real-money production ready: **NO**. External secrets, receiving route, providers, migrations, schedules, DB concurrency execution, callback delivery and monitoring are not live-verified.

## Migrations

- Payments `6_canonical_block_time`: additive nullable evidence timestamp. Rollback drops it after audit review.
- Presale `19_late_payment_review_and_audit`: adds `manual_review` and audit table. Resolve review rows before rollback.
- Presale `20_disable_active_test_pricing`: blocks unsafe activation and intentionally fails if unsafe active data exists.
- Presale `21_presale_lifecycle_audit_trigger`: adds lifecycle trigger/function; retain exported audit records on rollback.
- Presale `22_webpay_settlement_claims`: adds one-reference/one-order replay authority; do not roll back while WebPay is enabled.
