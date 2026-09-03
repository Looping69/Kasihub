# Presale Phase 1 baseline

Date: 2026-09-03

Rollback baseline and inspected `HEAD`: `0c04acb388e851933d69ec3b914549ed013ad280`

Scope: source and local contract verification only. No deployment, campaign mutation, provider action, payment, incorporation, or production-data change was performed.

## 1. Current baseline

At inspection time `HEAD`, `main`, `origin/main`, and `encore/main` resolved to the rollback baseline and the working tree was clean. The browser boundary is Next.js `/api/*`; `src/lib/encore-client.ts` forwards authenticated requests to Encore. Encore and PostgreSQL records remain authoritative.

Applicant-facing Next routes:

| Surface | Routes |
| --- | --- |
| Entry | `/presale`, `/shares/account` |
| Invitation/application | `GET /api/presale/offer`, `POST /api/presale/members`, `POST /api/presale/progress` |
| Applicant account | `POST /api/presale/auth/login`, `POST /api/presale/auth/logout`, `GET /api/presale/portal`, `POST /api/presale/ecosystem-account` |
| KYC | `POST /api/presale/kyc-session`, `GET /api/presale/kyc-status`, `POST /api/presale/kyc-documents` |
| Reservation/payment | `POST /api/presale/orders`, `GET /api/presale/orders/[reference]`, `POST .../payment-proof`, `POST .../payment-recheck`, `POST .../webpay-checkout`, `POST .../cancel` |
| Provider callbacks | `POST /api/presale/webpay/notify`, `POST /api/presale/webpay/process` |
| Certificate | `GET /api/presale/certificates/[certificateNumber]` |

Primary Encore services are `encore/domains/presale/api.ts`, `encore/domains/payments/{obligations,intents,attempts,verification,registry}.ts`, and `encore/domains/shares/{issuance,api}.ts`. Current rails are `remitano_usdt` (canonical-chain verification plus configured custody policy) and `webpay_card` (hosted checkout plus signed provider notifications). No InstaPay rail exists.

Public applicant journey states are: `invite_required`, `application_in_progress`, `kyc_pending`, `eligible_to_reserve`, `awaiting_payment`, `payment_submitted`, `pending_confirmations`, `underpaid`, `manual_review`, `confirmed`, `awaiting_incorporation`, `issued`, `revoked`, `cancelled`, and `expired`.

Persisted reservation/order states are `awaiting_payment`, `payment_submitted`, `payment_detected`, `confirmed`, `manual_review`, `expired`, `cancelled`, and `incorporated`. Incorporation states are `pending`, `batched`, and `incorporated`. Certificate states are owned by the shares service; the applicant reducer currently consumes `awaiting_issuance`, `issued`, `revoked`, and `issuance_error` holding evidence.

Schema compatibility matters:

- Migrations are additive and ordered across separate `presale`, `payments`, `shares`, `identity`, `membership`, and `kyc` databases; there is no global transaction.
- Migration `presale/23_payment_obligation_authority.up.sql` deliberately relaxes the handoff constraint for rollback compatibility. Source compatibility is not proof that every runtime database is at the same migration level.
- Presale-to-shares delivery uses durable outbox/inbox records and idempotent issuance keys because the services commit independently.
- Exact financial values are database decimals represented as strings at the public contract boundary.

## 2. Current workflow map

`UNKNOWN` means the inspected code does not prove the external outcome.

| Transition | Frontend | Next API | Encore authority | Main data | Before -> after | User action | Failure/recovery |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Invite | `/presale` | `GET /api/presale/offer` | `getPresaleOffer` | `presale_campaigns`, `presale_invitations` | invite token -> validated offer | Open private link | Invalid/expired/exhausted invitation fails closed |
| Applicant profile | `presale-client.tsx` phase 1 | `POST /api/presale/members` | `registerPresaleMember` | identity users/profiles/sessions; `presale_applications` | no applicant -> scoped applicant and draft | Submit identity/account fields | Transaction rollback; bounded public error; welcome mail is non-authoritative |
| Investment selection | phase 2 | `POST /api/presale/progress` | `updatePresaleApplicantProgress` | application/version encrypted payload | draft phase -> persisted progress | Choose paid quantity | Server validates invitation/campaign and persisted phase |
| Funding details | phase 3 | `POST /api/presale/progress` | same | application version/declarations | phase 2 -> phase 3 | Supply source/bank fields where required | Invalid application payload rejected |
| KYC | phase 4 / Didit iframe | `POST kyc-session`, `GET kyc-status` | KYC service calls from presale bridge | `kyc_cases`, application declarations | incomplete -> pending/approved/review | Start or refresh verification | Poll/retry; rejected/failed maps to manual review; provider completion is externally `UNKNOWN` until signed status is stored |
| Reservation | phase 5 | `POST /api/presale/orders` | `createPresaleOrder` | campaigns, invitations, applications, orders; payment obligation/intent | eligible -> `awaiting_payment` | Accept terms and create | Row locks, quota checks, rollback; confirmation email failure does not undo committed reservation |
| Payment | `ReservationStateCard` | payment-proof or WebPay checkout | `submitPresalePaymentProof` / `createPresaleWebPayCheckout` | payment obligations, intents, attempts; presale order | awaiting -> submitted/detected | Submit hash or open hosted checkout | Async retry queue; no browser settlement authority |
| Verification | account/card state | payment recheck / signed WebPay callbacks | payment verifier / WebPay handlers | payment attempts, obligations, settlement claims, audit events | submitted -> pending/underpaid/manual-review/confirmed | Recheck only when allowed | Confirmation depth retry; mismatch/manual review; provider and chain evidence retained |
| Incorporation | admin surface | admin presale routes | `preparePresaleIncorporation`, `applyPresaleIncorporation` | incorporation batches, outbox/inbox | confirmed/pending -> batched/incorporated | Controlled admin action or reconciliation | Manifest, locks, retry-safe order reference; no cross-DB atomic commit |
| Issuance | applicant account | portal/portfolio reads | `incorporateConfirmedPresaleOrder` -> shares issuance | share issuance operations, purchases, certificates | awaiting issuance -> issued | No applicant mutation | Idempotency key `presale:<orderReference>`; outbox retries and reconciliation |
| Certificate | `/shares/account` | certificate download route | shares portfolio/certificate APIs | `share_certificates` | issued -> downloadable/verifiable | Download or verify | Ownership checks; revoked/inconsistent evidence fails closed |

## 3. Authority boundaries and frontend audit

| Location | Current logic | Backend authority available? | Risk | Recommended Phase 2 fix |
| --- | --- | --- | --- | --- |
| `presale-client.tsx:177-241` | Every completed portal request replaces `applicantAuthority` | Yes, atomic `/portal` contract | **High:** out-of-order responses can restore an older snapshot (KIP-029) | Add monotonically increasing request generation or abort superseded requests; accept only latest response |
| `:214-240` | First portal response hydrates application/draft fields and selected rail once | Yes | Medium: a pre-reservation draft can remain visually stale, though actions are gated | Separate editable-form hydration from transactional authority and clear it when reservation authority arrives |
| `:298-307` | KYC refresh sets local verification and phase before refreshing portal | Yes | Medium: temporary presentation can move to phase 5 before new authority lands | Present KYC response as status only; let refreshed journey choose the actionable view |
| `:330-345` | Browser calculates offer estimates and detects test pricing with numeric comparison | Offer supplies inputs; reservation supplies final values | Medium: estimates can diverge in precision/rounding or label | Return formatted estimate and pricing-mode label from offer authority |
| `:151,234,796-801` | Browser defaults to Remitano and hardcodes both rail controls | Offer does not expose an explicit allowed-rails collection | High: browser can present a rail the campaign should not allow | Add authoritative allowed payment methods and rail presentation to offer contract |
| `:83-89,149,235-238` | Browser owns the five-screen presentation and applies server next step | Continuation supplies next step | Low/medium: acceptable presentation state, but sequencing can regress | Keep phases presentational; bind action availability only to journey actions |
| `:358-360` and `applicant-authority-view.ts` | Reservation presence outranks application/continuation/KYC within one parsed snapshot; create is denied when a reservation exists | Yes | Low inside one snapshot; does not cure out-of-order snapshots | Retain gate and add request sequencing |
| `ReservationStateCard` | Payment/cancel/recheck CTAs use `allowedActions`; financial obligation fields use reservation contract | Yes | Low | Preserve this contract; remove residual duplicate `order` presentation values later |

The browser does not directly call Encore and cannot grant applicant authority. `readApplicantAuthority` rejects malformed contracts and exposes only `contact_support`. The remaining split brain is orchestration and presentation, not backend authorization.

## 4. Confirmed bugs

### KIP-029: confirmed exposure

`loadApplicantPortal()` has multiple callers (initial hydration, KYC refresh, payment/order polling, and explicit refreshes). Each response unconditionally executes `setApplicantAuthority(authority)`. There is no request sequence, generation, or abort check. Therefore this ordering is possible:

1. Request A starts before reservation creation and reads a draft/no-reservation snapshot.
2. Reservation is committed; request B returns active reservation authority and the payment CTA renders.
3. Request A completes later and replaces authority with the older editable state.
4. The application view and `Create reservation` path can reappear if request A carried `create_reservation`.

Within a single internally contradictory response, the new Phase 1 presentation gate ensures reservation presence wins. That containment does **not** solve cross-response ordering. The sequencing repair belongs in Phase 2.

## 5. Suspected bugs and unknowns

- The offer contract lacks explicit rail eligibility; hardcoded controls can disagree with campaign/provider readiness.
- Client-side decimal multiplication is display-only, but its rounding/format semantics are not an authoritative quote.
- The portal reads several databases sequentially. A response can represent a mixed-time snapshot across application, KYC, payment, and shares evidence. Whether the production database topology exposes a harmful inconsistency is `UNKNOWN` without runtime concurrency tests.
- Actual Didit, Remitano/custody, WebPay, email delivery, Encore migration state, and production certificate issuance were not exercised in Phase 1.

## 6. Hardcoded financial presentation catalogue

Production-source occurrences found in the scoped presale/admin search:

| Location | Hardcode | Assessment |
| --- | --- | --- |
| `encore/domains/presale/webpay.ts:4` | `WEBPAY_UNIT_PRICE_ZAR = "450.00"` | Backend fallback price; authoritative at reservation creation but not campaign-derived |
| `encore/domains/presale/api.ts:304` | campaign network schema is literal `bsc` | Backend policy hardcode |
| `encore/domains/presale/api.ts:321` | rail enum and default `remitano_usdt` | Backend policy/default |
| `src/app/presale/presale-client.tsx:151` | local rail defaults to `remitano_usdt` | Frontend authority risk |
| `src/app/presale/presale-client.tsx:796-801` | Remitano/WebPay options and availability are encoded in JSX | Frontend authority risk |
| `src/components/admin/admin-presale-defaults.tsx:26,50,71` | BSC default and fixed BSC label | Admin presentation/policy hardcode |
| `src/components/admin/admin-shares.tsx:361` | “Phase 1 bonus special” | Legacy display hardcode |
| `encore/domains/presale/testing-api.ts:82` | `25.00 USD` fixture campaign | Test-only; must never be production authority |

No production client-side receiving address or token-contract literal was found in `/presale`; both render from reservation authority. `$25`/`Phase 1` values also occur in tests and fixtures; they are test data, not runtime pricing authority. No replacement was made in this phase.

## 7. Test coverage added and existing invariant evidence

Added focused tests cover:

- reservation presence outranking editable application, draft continuation, and late KYC state in one snapshot;
- suppression of `Create reservation` whenever a reservation exists;
- cancelled/expired paths requiring an explicit backend `create_reservation` action;
- absent/malformed authority exposing no transactional actions;
- authoritative reservation prices/totals passing through unchanged;
- CTA source-contract gates and explicit documentation of the KIP-029 sequencing gap;
- Dev Sentinel retaining manual diagnostics without automatic blocking alerts.

Existing focused tests already cover funded cancellation denial (`reservation-contract.test.ts`), exact-once payment settlement (`verification.integration.test.ts`), durable/idempotent issuance (`issuance-authority.contract.test.ts`), and reservation-to-obligation handoff (`applicant-portal.contract.test.ts`). Phase 1 does not claim those source tests prove live provider or database behaviour.

Verification executed on 2026-09-03:

- `npm test`: 40 files, 237 tests passed.
- Focused new/frontend contracts: 5 files, 40 tests passed.
- Encore pure contract selection: 4 files, 55 tests passed.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run build`: passed; Next.js 16.3.0 produced 92 routes/pages.
- `git diff --check`: passed.
- Encore payment integration/runtime verification: **not completed**. Direct Vitest lacks `ENCORE_RUNTIME_LIB`; `encore test ./...` then failed before execution with `starting daemon: timed out waiting for daemon to start`. This is an explicit Phase 2/runtime gate, not evidence of a backend failure or pass.

## 8. Dev Sentinel change

The automatic high-priority popup was removed. The compact `DEV` button, expandable diagnostics, timeline, copy, dismiss, and clear controls remain available. Closed diagnostics no longer create a large overlay over reservation/payment controls. This development-only component does not alter production financial behaviour.

## 9. Files changed

- `docs/presale-phase-1-baseline.md`
- `src/app/presale/presale-client.tsx`
- `src/app/presale/presale-client.contract.test.ts`
- `src/lib/applicant-authority-view.ts`
- `src/lib/applicant-authority-view.test.ts`
- `src/devtools/dev-sentinel.tsx`
- `src/devtools/dev-sentinel.contract.test.ts`

## 10. Risks before Phase 2

1. KIP-029 remains open across concurrent portal responses.
2. Rail availability and estimate formatting are still partly browser-defined.
3. Cancelled/expired orders remain in the portal reservation field while continuation may reopen phase 5; the desired historical-versus-current obligation contract needs one backend decision.
4. Multi-database portal reads and issuance need runtime race/failure verification.
5. Schema, provider, and deployed revision compatibility remain unverified.

## 11. Exact recommended Phase 2 work

1. Add request-generation/abort control to portal hydration and a deterministic deferred-response browser test reproducing KIP-029.
2. Define a backend `currentReservation` versus `historicalReservation` contract for cancelled/expired orders; do not discard audit evidence.
3. Add authoritative `allowedPaymentMethods`, formatted estimates, and pricing-mode labels to the offer contract; render only those rails.
4. Remove duplicate transactional fields from the local `Order` display model and use reservation/obligation authority for all amounts, networks, deadlines, and CTAs.
5. Add Encore integration tests for cancellation versus concurrent payment activity, duplicate settlement, mixed-time portal reads, and outbox retry after one-database failure.
6. Verify migrations and the full applicant path in an isolated local environment. Only after those gates pass should Phase 2 be considered for staging; production remains out of scope.
