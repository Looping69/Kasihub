# KaSiHub USDT Share Sale

## Progress Report and Path Forward

Prepared: 10 August 2026
Author: Klaasvaakie `( |╲ )`

## Executive position

KaSiHub is approximately 65-70% technically prepared for a controlled, invitation-only USDT share reservation campaign. The core isolated presale implementation exists on commit `9a515d6`, but it is not part of current GitHub `main` and is not deployed to either the Vercel frontend or Encore backend. Both live presale routes currently return HTTP 404. No buyer funds should be accepted yet.

The remaining work is focused and tractable: selectively reconcile the presale implementation onto current main, finalize the operational blockchain configuration, connect a real chain-verification provider, deploy the isolated database and APIs, and complete a small-value end-to-end transaction test. Independent legal and compliance approval remains a separate launch gate.

## Verified current state

- Current GitHub main: `643ea65eafad353043da3060a70beccd9bfa1622`.
- GitHub quality workflow passed for this revision.
- Encore staging deployment workflow passed for this revision.
- Vercel production is online and connected to the verified Encore staging backend.
- Normal international-member and administrator logins work through the deployed frontend.
- Database-backed dashboard, wallet, shares, matrix and administrator analytics load successfully.
- International KYC application gates and the database approval trigger remain present.
- `https://kasihub.vercel.app/presale` returns HTTP 404.
- Encore `/presale/offer` returns HTTP 404.

## What already exists

The isolated implementation on commit `9a515d6` provides:

- A separate `presaleDb` PostgreSQL resource and dedicated migrations.
- Private, hashed invitation tokens with allocation and expiry controls.
- Atomic share reservations that release inventory when unpaid orders expire.
- Buyer-facing USDT payment instructions and transaction-hash submission.
- A signed HMAC-SHA256 verifier webhook.
- Exact matching of network, official token contract, receiver, amount and confirmation depth.
- Deduplication of provider events and one-transaction-per-order enforcement.
- A controlled state machine from reservation through detected and confirmed payment.
- Deterministic incorporation manifests for later migration into the authoritative share ledger.
- A hidden buyer route that is not exposed in public navigation.
- Contract tests covering normalization, deterministic signatures and tamper rejection.

The design intentionally does not issue final shares or certificates directly. Confirmed presale orders remain isolated until a controlled incorporation process verifies the buyer's member profile and KYC, applies an idempotent share issuance, and reconciles the resulting purchase and certificate records.

## Remaining blockers

### 1. Reconcile the implementation

Port commit `9a515d6` onto current main using a focused branch. The historical merge preview shows only two meaningful overlapping files: the Encore resource registry and the continuity log. The port must be reviewed against the current authentication, KYC, registration, payment and deployment contracts.

### 2. Finalize operational inputs

The owner must approve the exact blockchain network, official USDT contract, controlled receiving address, confirmation depth, share allocation, USDT price, campaign dates and payment window. These values must be verified independently before campaign activation.

### 3. Connect payment verification

A transaction hash supplied by a buyer is evidence, not settlement proof. A real monitoring provider must inspect the selected chain and send authenticated events. The provider must be configured with the Encore `PresaleWebhookSecret`, and replay, mismatch, underpayment and delayed-confirmation cases must be tested.

### 4. Complete legal and compliance approval

The offering documents, eligible buyers, jurisdictional restrictions, KYC/AML process, issuer authority, tax treatment and custody controls require approval from appropriately qualified advisers. The application must not invent share rights beyond the governing MOI and Share Subscription Agreement.

### 5. Deploy and prove the complete flow

Deploy the isolated database migration and backend first. Verify the backend activation contract, then deploy the frontend through the established canary and rollback path. Only after both surfaces are live should a private campaign and invitation be created.

## Recommended execution path

### Phase A - Reconciliation and tests (1-2 working days)

1. Create a focused branch from current GitHub main.
2. Selectively port the presale files and resolve resource registration cleanly.
3. Align the presale with current KYC, auth and registration contracts.
4. Expand tests for inventory races, expiry, event replay, mismatched token/receiver/amount, underpayment, confirmation reorganization and incorporation idempotency.
5. Run lint, typecheck, unit coverage, production audit, build, browser tests, `encore check` and Encore tests.

### Phase B - Provider and staging activation (1-2 working days)

1. Configure the approved network, token, receiver and confirmation policy.
2. Connect and authenticate the monitoring provider.
3. Set the staging secret without exposing it in source or logs.
4. Deploy Encore staging and verify migrations and endpoint activation.
5. Deploy a Vercel preview or controlled production candidate.
6. Run zero-value/mocked tests followed by one deliberately small real USDT transaction.

### Phase C - Private production launch (about 1 working day)

1. Confirm legal/compliance authorization and signed offering documents.
2. Deploy the exact verified revision with rollback preserved.
3. Create a tightly capped private campaign and one test invitation.
4. Verify reservation, payment detection, confirmation and manifest generation.
5. Reconcile the manifest without automatically issuing shares until the controlled importer is approved.
6. Expand invitation volume only after the first production reconciliation is clean.

## Launch acceptance criteria

The private sale is ready only when all of the following are true:

- The exact GitHub revision has green frontend and Encore quality gates.
- Vercel and Encore expose the expected presale contracts without 404/5xx errors.
- The presale database is isolated from the live shares ledger.
- Invalid invitations and expired reservations fail closed.
- The buyer cannot choose or override the token contract, receiving wallet or amount.
- A transaction hash alone cannot confirm payment.
- Incorrect network, contract, receiver, amount, signature or confirmation count is rejected.
- Duplicate events and transaction reuse are idempotently rejected.
- A small real payment reaches confirmed state through the configured provider.
- The incorporation manifest is deterministic and reconciles exactly.
- Legal/compliance authorization is documented.
- Rollback is preserved and operational monitoring is active.

## Estimated distance

With all operational inputs available, staging should be achievable in approximately 2-3 focused working days and a carefully tested private production campaign in approximately 3-5 working days. Provider onboarding, wallet-control verification and legal/compliance review can extend that schedule independently.

This report describes technical readiness and delivery risk. It is not legal, financial, tax or investment advice.
