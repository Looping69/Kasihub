# Kasihub International KYC & Payments Architecture

Author: Klaasvaakie ( |╲ )

## Purpose

This document records the implementation architecture for Kasihub's local and international KYC/payment split. It is the durable engineering reference for the `feature/international-kyc-usdt-payments` branch and must be kept synchronized with implementation changes.

## Core routing model

### Local / InstaPay-supported members
- KYC authority: InstaPay.
- Primary wallet/payment rail: InstaPay.
- Kasihub stores authoritative internal profile/order/ledger/settlement state derived from trusted provider outcomes.
- Browser-submitted InstaPay verification timestamps or account references are never authoritative.

### International members
Current international citizenship classifications:
- `SA_CITIZEN_ABROAD`
- `FOREIGN_CITIZEN_ABROAD`
- `INTL_COMPANY`

For these members:
- KYC authority: Kasihub international KYC.
- Payment rail: provider-independent USDT on-chain attestation.
- Initial supported blockchain families planned: TRON/TRC-20 and BSC/BEP-20.
- KYC must be verified before regulated/paid international actions are allowed.

### Common Kasihub core
Both rails converge on Kasihub-owned state:
- payment obligations/order state,
- settlement state,
- ledger entries,
- audit history,
- downstream fulfilment events,
- product outcomes such as shares, membership access and commissions.

External providers never own Kasihub's internal business truth.

## Trust boundaries

### Registration
The client may submit applicant facts, including citizenship and membership classification, but must not choose:
- profile type,
- membership plan code,
- KYC provider/rail,
- payment rail,
- provider verification timestamps,
- provider account references.

`resolveRegistrationPolicy()` is the server-owned decision function. Unknown citizenship or membership types fail closed.

The supported public registration path is:

`POST /registration/secure-start`

The Next registration gateway forwards applicant facts only. Contract tests include hostile legacy fields and assert they are not forwarded.

The legacy `POST /registration/start` endpoint remains deprecated and is tracked in `docs/implementation-issues.md` until it is removed, made non-public or refactored to the same policy boundary.

## KYC lifecycle

### International KYC case
Provider identifier:

`kasihub_international`

International profiles receive a Kasihub-owned KYC case. A local profile cannot create an international KYC case.

Current status model inherited from `kyc_cases`:
- pending
- approved
- rejected

### Verification gate
`requireInternationalKycVerified(profileId)` is the reusable backend compliance gate.

Behaviour:
- local profile: international KYC is not required;
- international profile without case: blocked;
- international profile pending/rejected: blocked;
- international profile approved: allowed.

The USDT payment intent API calls this gate before an international member can create an intent.

### Approval guard
International KYC approval is protected at the database boundary. A `kasihub_international` case cannot transition to `approved` unless its `result_payload` records:
- `policySatisfied: true`
- a non-empty `policyVersion`

This intentionally fails closed while the approved evidence matrix remains undefined.

## KYC evidence storage

Evidence bytes are stored only in the private Encore `documents` object bucket. Database records store metadata and object keys.

### Upload controls
Endpoint:

`POST /kyc/international/cases/:caseId/documents`

Controls:
- authenticated profile ownership/admin access;
- case must belong to `kasihub_international`;
- case must be pending;
- 10 MB maximum upload size;
- allowed content types: PDF, JPEG, PNG;
- file magic/signature must match declared content type;
- SHA-256 stored for evidence integrity/deduplication;
- duplicate evidence within a case is detected;
- object storage remains private;
- audit event created.

Required headers:
- `Content-Type`
- `X-Filename`
- `X-Document-Type`

`X-Document-Type` is metadata only until the approved evidence matrix is defined. It must not be treated as proof that policy requirements were satisfied.

### Evidence review
Member/admin listing:

`GET /kyc/international/cases/:caseId/documents`

Admin review:

`POST /admin/kyc/international/documents/:documentId/review`

Admin download:

`GET /admin/kyc/international/documents/:documentId/file`

Evidence review status:
- uploaded
- approved
- rejected

Rejection requires a reason and review changes are audited.

### Malware scanning
Malware scanning/quarantine is not yet implemented. This is tracked as KIP-011 and must be resolved or covered by an explicit pilot compensating control before broad production rollout.

## International KYC evidence policy

The required evidence matrix is intentionally not invented by engineering.

Still required from approved compliance policy:
- required evidence for `SA_CITIZEN_ABROAD`;
- required evidence for `FOREIGN_CITIZEN_ABROAD`;
- required company and beneficial-owner evidence for `INTL_COMPANY`;
- whether evidence requirements vary by product or transaction value;
- re-verification/expiry requirements;
- jurisdiction-specific restrictions.

Once approved, this policy must be versioned server-side and KYC case approval must evaluate all required evidence against the active version before the database approval guard can pass.

## Payment architecture

### Principle: obligation before payment intent
The browser never tells Kasihub how much it owes.

Product domains create an authoritative `payment_obligations` record through the internal payment service. An obligation contains:
- product/subject type and reference;
- payer profile;
- beneficiary profile;
- settlement currency;
- settlement amount;
- lifecycle status;
- product metadata.

Internal endpoint:

`POST /internal/payments/obligations`

Cancellation endpoint:

`POST /internal/payments/obligations/:obligationId/cancel`

These endpoints are `expose: false` and are intended for trusted Encore service-to-service use.

### Receiving configuration
A payment intent does not accept a receiving address, token contract, confirmation threshold or TTL from the member.

Admin-only configuration rotation:

`POST /admin/payments/receiving-config`

Admin listing:

`GET /admin/payments/receiving-config`

Each active receiving configuration defines:
- network;
- USDT currency;
- receiving address reference;
- approved token contract;
- token decimals;
- minimum confirmations;
- payment-intent TTL.

Rotation retires the previous active configuration for that network/currency and creates a new active record under a payments-database advisory lock.

Because the global audit database is separate from `paymentsDb`, critical configuration mutations write `payment_configuration_events` inside the same transaction as the configuration change. The global audit database is a secondary mirror.

### Payment intent creation
Public endpoint:

`POST /payments/intents`

Member-controlled fields are intentionally narrow:
- member profile id;
- authoritative obligation id;
- supported network choice (`tron` or `bsc`).

Server-owned fields:
- amount;
- settlement currency;
- receiving address;
- USDT token contract;
- decimals;
- confirmation threshold;
- intent expiry;
- KYC eligibility.

Creation requirements:
- authenticated profile ownership;
- persisted profile must route to international USDT;
- Kasihub international KYC must be verified;
- obligation must be open and belong to the payer;
- obligation must be denominated in USDT;
- active receiving configuration must exist;
- configuration must define a TTL;
- `Idempotency-Key` is mandatory.

A live intent for an obligation is reused only if the requested network matches. A conflicting network request fails rather than silently changing payment terms.

### Payment intent state
Member status/read endpoint:

`GET /payments/intents/:id`

Current state-machine foundation:
- created
- awaiting_transfer
- submitted
- verifying
- pending_confirmations
- underpaid
- manual_review
- confirmed
- settling
- settled
- expired
- failed
- rejected
- cancelled

Underpaid intents may be retried, manually reviewed, expired or cancelled. This is required so stale underpayments cannot permanently block replacement intents.

### Transaction-hash submission
Endpoint:

`POST /payments/intents/:intentId/attempts`

Submission rules:
- caller must own the intent;
- intent must be `awaiting_transfer` or `underpaid`;
- elapsed intent TTL expires the intent instead of accepting a late hash;
- submitted hash is canonicalized to exactly 64 lowercase hexadecimal characters;
- an optional `0x` presentation prefix is stripped;
- global replay protection prevents the same canonical hash being associated with another intent;
- submission moves the intent only to `submitted`;
- a durable `payment.attempt.submitted` outbox event is created for verifier processing.

A submitted hash is never evidence of payment on its own.

### Canonical chain verification
The next verifier phase will consume `payment.attempt.submitted` and independently obtain blockchain evidence.

Required verification facts include:
- transaction exists;
- transaction execution succeeded;
- expected network;
- exact approved USDT contract;
- expected receiving address;
- canonical transferred amount;
- required confirmations;
- canonical transaction/block identifiers;
- replay protection.

RPC/explorer outages must leave the payment pending/retryable. They must never convert network unavailability into payment approval or permanent rejection.

### Replay protection
Transaction hashes are globally unique in `payment_attempts` using a case-insensitive unique index. Transaction hash canonicalization also removes case and `0x` presentation differences before storage. A transaction must never settle more than one payment intent.

### Replacement intent behaviour
An obligation may receive a replacement payment intent only after a prior intent reaches a terminal non-settlement outcome such as expiry, failure, rejection or cancellation. Competing live or settled intents remain forbidden.

### Migration compatibility
`payment_intents.order_id` now references the canonical payment obligation. The historical column name is retained for migration compatibility.

The obligation foreign key is initially created `NOT VALID` to avoid breaking a preview database that might contain historical branch-only intent rows. New/updated rows are still constrained. After deployed data is inspected/backfilled, a follow-up migration must validate the constraint.

### Outbox/idempotency
The payments schema includes request/idempotency hashes and unique event keys so retries cannot duplicate intent creation, verification work, settlement or downstream business effects.

## Expected end-to-end international flow

1. Product domain creates authoritative payment obligation.
2. Member has approved Kasihub international KYC.
3. Member requests a USDT intent for an obligation and supported network.
4. Server selects approved receiving configuration and locks payment terms.
5. Member transfers USDT.
6. Member submits transaction hash.
7. Submission queues verifier work; no confirmation occurs yet.
8. Verifier obtains canonical chain evidence.
9. Required confirmations are reached.
10. Kasihub settles atomically/idempotently.
11. Durable settled event triggers product fulfilment.
12. Product domain fulfils shares/membership/order without duplicating financial verification logic.

## Remitano boundary

Remitano may be selected as an inbound collection provider for approved international payment routes, including KaSiShares payment obligations. Each configured route remains explicit: one provider, one supported network, one exact USDT contract and one controlled receiving address.

Inbound international settlement must still be based on canonical blockchain evidence. A Remitano charge, wallet address or provider event is collection evidence; it does not by itself settle a share purchase.

The two initial routes are TRON and BNB Smart Chain. They are configured as separate locked receiving configurations so a buyer cannot select, substitute or cross-send between networks. Provider credentials must be server-only managed secrets and must not appear in ClickUp, browser code, logs or source control.

## Security invariants

The following are non-negotiable:
- no provider secrets in source control, browser code, ClickUp task text, logs or general application tables;
- no browser field can directly approve KYC or payment;
- the browser cannot choose the amount, token contract or receiving wallet;
- KYC verification and payment verification are separate facts;
- one blockchain transaction cannot credit twice;
- provider/RPC failure must fail safe to pending/retryable state;
- KYC evidence remains private;
- privileged KYC and payment configuration operations require admin access;
- critical payment configuration has an audit record in the same payments transaction;
- all meaningful KYC/payment transitions are auditable;
- downstream product logic must not live inside blockchain verification code.

## Testing requirements

Before production rollout, validate:
- all citizenship routing cases;
- unsupported/unknown values fail closed;
- forged registration authority fields are ignored/not forwarded;
- local members cannot use international KYC/payment endpoints;
- international members cannot proceed past KYC gates while pending/rejected;
- KYC upload size/type/signature controls;
- duplicate document handling;
- privileged evidence review/download authorization;
- database-level international approval guard;
- obligation authority and ownership checks;
- receiving configuration authorization/rotation;
- intent idempotency and concurrent creation races;
- payment state transitions;
- transaction-hash case/prefix replay attempts;
- duplicate hash across different intents;
- expired and underpaid intent behaviour;
- RPC outage behaviour;
- settlement idempotency;
- downstream fulfilment retry without duplicate business effects.

## Rollout order

1. Secure registration and routing.
2. International KYC case/evidence workflow.
3. Approved evidence policy and KYC completion gate.
4. Payment obligation/intent/submission foundation.
5. TRON/BSC blockchain verification.
6. Settlement/outbox integration.
7. KasiShares first production integration.
8. Admin operations/observability.
9. Controlled production pilot.
10. Remitano outbound payout adapter, if still required.

## Known unresolved items

See `docs/implementation-issues.md` for the live issue register. Important unresolved items include:
- credential rotation;
- retirement/hardening of the legacy registration endpoint;
- approved international KYC evidence matrix;
- malware scanning/quarantine for KYC evidence;
- production TRON/BSC receiving/token/confirmation/TTL configuration;
- validation of the payment-obligation foreign key after deployed data inspection;
- direct Encore Cloud deployment/runtime access from the current workspace.

( |╲ )
