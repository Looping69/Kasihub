# KaSiShares Applicant Journey Modernization

Status: execution contract for the controlled backend-first programme

Baseline: `origin/main` at `496c4ec64717bfa7b2d4a9d3b66a1d13a530ca2a`

Initial branch: `Klaasvaakie/applicant-journey-contracts`

## Scope

This programme covers the private applicant surfaces and the contracts that support them:

- `/presale`
- `/shares/account`
- crypto and card payment presentation
- certificate download and public verification
- the supporting Next.js BFF and Encore APIs

It does not cover the normal member `SharesView`, unrelated admin or reconciliation work, share-allocation policy changes, production payment experiments, or files in the dirty primary checkout.

## Non-negotiable invariants

1. Applicant access remains invitation-only.
2. Presale sessions remain separate from ecosystem member sessions.
3. Browser state never grants eligibility, selects a continuation point, or proves settlement.
4. The server owns phase, price, bonus, total, network, token, receiver, deadline and payment-method availability.
5. Monetary obligations cross API boundaries as decimal strings or integer minor units.
6. KYC approval is required before reservation creation.
7. Canonical chain and custody evidence remains the settlement authority.
8. A browser return, submitted hash, webhook delivery, or provider reference is evidence to verify—not proof of payment.
9. One obligation may create at most one share purchase and one certificate.
10. An active reservation blocks a second purchase for the same applicant and invitation.
11. Cancellation is allowed only when the backend confirms no card checkout or crypto submission has started.
12. No synthetic production payment, order, shareholder, or certificate record may be created for testing.

## Authoritative journey state

Encore reduces persisted application, KYC, order, payment and certificate facts to one `journey` object. Raw database statuses may remain in compatibility fields during rollout, but clients must move toward rendering `journey.state` and `journey.allowedActions`.

| State | Applicant meaning | Editable | Allowed action class | Polling |
| --- | --- | --- | --- | --- |
| `invite_required` | No applicant application exists | No | Start with a valid invitation | None |
| `application_in_progress` | Application is incomplete | Application only | Resume application | None |
| `kyc_pending` | Identity decision is not approved | Application only | Resume or refresh KYC | KYC |
| `eligible_to_reserve` | Application and KYC gates are complete | Application and reservation | Create reservation | None |
| `awaiting_payment` | A locked obligation exists | No | Use its selected rail; cancel only if explicitly eligible | None |
| `payment_submitted` | A hash or provider submission exists | No | View or recheck | Payment |
| `pending_confirmations` | Canonical transfer exists but lacks finality | No | View or recheck | Payment |
| `underpaid` | Verified amount is below the obligation | No | Submit permitted recovery evidence or contact support | None |
| `manual_review` | Evidence or issuance is inconsistent | No | Contact support | None |
| `confirmed` | Settlement is authoritative | No | View allocation | Incorporation |
| `awaiting_incorporation` | Legal share/certificate workflow is incomplete | No | View allocation | Incorporation |
| `issued` | Active certificate exists | No | Download and verify certificate | None |
| `revoked` | Certificate is revoked | No | Verify revocation or contact support | None |
| `cancelled` | Reservation was cancelled before payment | Application only | Resume through the gated invitation | None |
| `expired` | Reservation deadline elapsed | Application only | Resume through the gated invitation | None |

Precedence is deliberate: certificate evidence outranks stale order state; payment-verification evidence outranks coarse presale order status; active reservation state outranks incomplete browser progress.

## Reservation contract

The additive `reservation` object is the durable applicant summary. It contains:

- order reference;
- phase number and label;
- campaign, issuer and share class;
- paid, bonus and total allocated shares;
- USD, USDT and applicable ZAR unit prices and totals as decimal strings;
- the locked payment method;
- network, token contract, receiver and required confirmations when applicable;
- payment deadline and accepted terms version;
- raw compatibility status and incorporation status;
- explicit cancellation eligibility and reason.

Clients must not recompute bonus allocation or authoritative totals. A locked reservation replaces editable controls with this object; it never makes the selected shares disappear.

## Payment hash contract

Submission format is network-specific and is checked before canonical storage:

- BSC: `0x` followed by exactly 64 hexadecimal characters.
- TRON: exactly 64 hexadecimal characters without `0x`.

Both forms are normalized to 64 lowercase hexadecimal characters for uniqueness and replay protection. Submission changes only the attempt state. Settlement still requires canonical chain evidence, receiver/token/network/amount matching, success, confirmation depth and duplicate-use protection.

## Backward-compatible rollout

The first release adds `journey`, `reservation`, and cancellation policy to the authenticated applicant portal while preserving existing response fields. No database migration or frontend renderer switch is included in this slice.

The next contract slice must resolve these known blockers before the frontend trusts `availablePaymentMethods`:

- WebPay currently has a legacy R450 server fallback instead of campaign-owned production configuration.
- Provider readiness is not yet represented as an explicit, environment-isolated backend capability.
- The public offer lacks a complete server-owned payment-method availability contract.
- The current frontend still contains a hardcoded Phase 1 / $25 label and client-calculated card presentation totals.
- P0: Applicant journey hydration can overwrite an existing reservation and expose the wrong CTA, creating a dead-end immediately before payment.

Those gaps must fail closed in the new contract before the old compatibility behavior is removed. They are recorded here rather than silently declared solved.

## Gates for this slice

- Every public journey state has one presentation rule and tested allowed actions.
- Applicant journey tests prove browser state is not an input.
- Reservation tests preserve paid, bonus and total shares and decimal strings.
- Cancellation tests fail closed after crypto submission or card checkout creation.
- Network-specific hash tests reject prefix, length and character mismatches.
- Existing frontend and Encore tests, lint, type checking and builds remain green.
- The final diff contains only the isolated programme files.

## Release boundaries

Backend additions deploy before any frontend consumer. The old frontend remains the rollback path. API changes remain additive until runtime observation proves the new renderer stable. No destructive migration is part of this programme, and no production payment is used as a release probe.
