# Complimentary share coupons

Implemented locally; not deployed or enabled in production.

## Operation

In Admin → Presale campaigns → Free share coupons, select a campaign and save a giveaway share limit. Redemption defaults to disabled. Codes can be prepared while disabled. Generate one recipient-bound code per email, with a fixed quantity, expiry and internal reason. Copy the returned codes immediately: only hashes are stored. Revoke and replace any lost code. This UI does not send emails.

When the campaign's coupon policy is enabled, its presale payment step offers “Redeem free shares coupon”. The signed-in recipient checks the code, reviews the exact complimentary quantity and accepts the existing application terms before claiming it. Existing identity verification and invitation limits still apply. There is no partial redemption, transfer, paid-order conversion, or BOGO stacking.

## Authority and accounting

- Redemption locks the invitation, campaign, coupon policy and coupon. A transaction consumes the coupon, updates campaign/invitation allocation, creates a confirmed zero-cash order and writes the existing issuance outbox event. Failed validation rolls back all these changes.
- Repeated submissions of the same coupon and terms return the original order, including retries with a new request key. Different terms cannot reuse the authorization.
- Issuance verifies the matching redeemed coupon and uses the existing operation ID, share inventory, distinctive number allocation, certificate seal and completion outbox. Paid-order command hashes remain unchanged.
- Complimentary shares have their own certificate and purchase columns. Paid and bonus quantities, acquisition cost and issue price are zero. Purchase status is `granted`. No payment intent, obligation, payment record or cash settlement timestamp is fabricated.
- Campaign `sold_shares` continues to mean consumed inventory and includes grants. Cash reporting must use monetary fields; the admin register and CSV expose the complimentary quantity separately.
- Disabling redemption stops new claims. Already committed grants can finish issuance, and replay remains available. Revoking an unused coupon does not revoke issued shares.

## Deployment order

1. Review the diff and existing WebPay issue below.
2. Deploy the Encore migrations and backend first: presale migration 25 and shares migration 11. There are no enabled policies by default.
3. Deploy the frontend. Validate admin authorization, a controlled recipient journey and certificate download in staging with the real session/KYC boundary.
4. Enable a bounded campaign allocation only after production activation is authorized. Monitor the coupon audit, issuance outbox and share register.

Do not roll the application back to code that cannot read complimentary records after grants have been issued. Disable redemption as the first containment action; retain the migrations and issuance reader.

## Verification (2026-09-05)

- Linux Encore compiler, service graph and database migration startup passed in a separate temporary local container workspace.
- Complete Encore test suite: 292 tests passed, including real database concurrency, one-time issuance, rejection rollback, recipient/expiry/revocation/limit checks, and recovery after missing inventory. Integration tests stub session/admin/KYC boundaries and use synthetic local identities; they do not prove a deployed authentication journey.
- Frontend tests: 268 passed, including complimentary PDF generation and sealed ledger mismatch rejection.
- Eight browser tests passed, covering coupon preview invalidation, complimentary holdings after reload, and existing paid reservation recovery. Browser API responses are controlled fixtures.
- Frontend TypeScript, ESLint and production build passed.
- A separate strict backend TypeScript invocation finds two existing errors in `fulfilWebPayPresalePayment`: `payment_deadline` is read but omitted from its query/type. Confirmed against HEAD before these changes; intentionally not changed in this coupon patch. The ordinary root TypeScript configuration excludes Encore, so it is not evidence of strict backend typing.

Production migrations, coupon activation, real payments and production share issuance were not performed.
