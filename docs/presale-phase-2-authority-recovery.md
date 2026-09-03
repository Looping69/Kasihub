# KaSiShares Phase 2 — Applicant Authority Recovery

Date: 2026-09-03
Baseline: `fa79b925689defc636d6602a66dcc31a80854113`

## Scope delivered

- Applicant portal requests now use monotonically increasing generations. A response may update authority, KYC, order progress, or hydrated draft data only when it belongs to the newest request.
- Hydration is explicit: `initial`, `loading`, `loaded`, `refreshing`, and `unavailable`. Refreshes retain the last valid authority snapshot; initial unresolved or malformed authority enables no transactional action.
- `currentReservation` is a distinct server contract. Cancelled and expired orders are excluded from current authority while all reservation records remain available in `reservationHistory`.
- The current server reservation outranks application, continuation, and KYC presentation state. The browser no longer keeps a second financial copy of the reservation.
- The offer response publishes backend-derived payment method IDs, labels, currency, unit price, pricing mode, availability, phase label, and bonus policy. It exposes no payment credentials or secret values.
- The browser has no default Remitano selection. It renders only enabled methods received from the backend and requires an explicit choice when more than one method is available.
- Order creation has no schema default for `paymentRail`. The backend recomputes payment-method availability under the reservation transaction and rejects an unavailable method before inventory is reserved.
- Phase 1's Dev Sentinel automatic-popup removal remains intact.

## Recovery evidence

- Deterministic deferred-response test proves that an older portal response resolving last cannot replace the newer authority snapshot.
- Hydration tests prove refresh preserves the last valid reservation and that an initial failure is unavailable/fail-closed.
- Authority presentation tests cover active-reservation precedence, cancelled/expired recovery, malformed authority, and exact server financial values.
- Payment-method authority tests cover configured rails, unavailable crypto routing, unavailable WebPay configuration, campaign pricing, bounded test pricing, and invitation override metadata.
- Existing reservation, settlement, applicant journey, payment verification, network/address/token/confirmation, and idempotency suites remain part of the release gates.

## Release gates

| Gate | Result |
| --- | --- |
| Frontend unit/contract tests | YES — 242 tests passed |
| Targeted Phase 2 backend tests | YES — 35 tests passed |
| Frontend TypeScript | YES |
| ESLint | YES |
| Next.js production build | YES |
| Browser recovery suite | YES — 18 tests passed |
| Full Encore suite | PARTIAL — 191 tests passed; five runtime-bound suites could not load because `ENCORE_RUNTIME_LIB` is not set |
| Encore application check | PARTIAL — local daemon timed out; Encore Cloud Build & Test passed in production deployment `217tib6agipbre2e052g` |
| Diff/security review | YES — scoped diff inspected; `git diff --check` passed |
| Git commit | YES — `098e2ac1` |
| GitHub push | YES — `origin/main` matched `098e2ac1` after push |
| Vercel deployment and live checks | YES — production deployment `dpl_FnGdVuxpqJ2SFLw2cCC34GhPcWmq` Ready; public routes returned HTTP 200 |
| Encore deployment and live checks | YES — production deployment `217tib6agipbre2e052g` succeeded; public health returned HTTP 200 |

## Readiness decisions

- Safe to commit: **YES**, subject to a final clean staged-path review.
- Safe to deploy frontend: **YES** — deployed and independently verified Ready with public HTTP checks.
- Safe to deploy backend: **YES** — Encore Cloud Build & Test and Deploy Release succeeded, and production health returned HTTP 200.
- Safe for real-money use: **NO**. No real payment, provider callback, custody settlement, or production reservation was executed in this phase. Code and controlled tests are not runtime financial proof.
- Payment-engine work performed: **NO**. The existing payment engine, custody reconciliation, settlement, and share issuance mechanisms were not redesigned.

## Remaining proof

1. Complete final test, lint, typecheck, build, and browser reruns from the release tree.
2. Obtain an Encore compile/deploy result in an environment with its runtime available.
3. Verify GitHub, Vercel, and Encore independently against the same commit.
4. Run authenticated, no-payment production smoke checks for offer authority, hydration, cancellation/expiry recovery, and reservation display.
5. Keep real-money readiness at **NO** until a separately authorised controlled production validation proves the complete browser-to-provider-to-settlement path.
