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
- order/payment obligation state,
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

The legacy `POST /registration/start` endpoint remains deprecated and is tracked in `docs/implementation-issues.md` until it is removed or made non-public.

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

This gate should be called by international payment intent creation and any other regulated international action.

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

Rejection requires a reason and all review changes are audited.

## International KYC evidence policy

The required evidence matrix is intentionally not invented by engineering.

Still required from approved compliance policy:
- required evidence for `SA_CITIZEN_ABROAD`;
- required evidence for `FOREIGN_CITIZEN_ABROAD`;
- required company and beneficial-owner evidence for `INTL_COMPANY`;
- whether evidence requirements vary by product or transaction value;
- re-verification/expiry requirements;
- jurisdiction-specific restrictions.

Once approved, this policy should be versioned server-side and KYC case approval must verify all required evidence against the active policy version.

## Payment architecture

### Payment intent principle
International payment is an attestation problem, not a screenshot/provider-webhook trust problem.

Expected flow:
1. Kasihub creates order/payment obligation.
2. Server locks network, token, amount, receiving wallet and policy.
3. Member transfers USDT.
4. Member submits transaction hash.
5. Kasihub verifies canonical blockchain evidence.
6. Required confirmations are reached.
7. Kasihub settles atomically/idempotently.
8. Durable outbox event triggers downstream business fulfilment.

### Payment states
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

### Replay protection
Transaction hashes are globally unique in `payment_attempts` using a case-insensitive unique index. A transaction must never settle more than one payment intent.

### Replacement intent behaviour
An order may receive a replacement payment intent only after a prior intent reaches a terminal non-settlement outcome such as expiry, failure, rejection or cancellation. Competing live or settled intents remain forbidden.

### Outbox/idempotency
The payments schema includes request/idempotency hashes and unique event keys so retries cannot duplicate settlement or downstream business effects.

## Remitano boundary

Remitano is not the inbound USDT source of truth.

Inbound international settlement must be based on blockchain evidence.

Remitano may later be introduced behind a replaceable outbound payout adapter only after inbound payment settlement is stable. Provider credentials must be server-only managed secrets.

## Security invariants

The following are non-negotiable:
- no provider secrets in source control, browser code, ClickUp task text, logs or general application tables;
- no browser field can directly approve KYC or payment;
- KYC verification and payment verification are separate facts;
- one blockchain transaction cannot credit twice;
- provider/RPC failure must fail safe to pending/retryable state;
- KYC evidence remains private;
- privileged review/download operations require admin access;
- all meaningful KYC/payment transitions are auditable;
- downstream product logic must not live inside blockchain verification code.

## Testing requirements

Before production rollout, validate:
- all citizenship routing cases;
- unsupported/unknown values fail closed;
- forged registration authority fields are ignored/not forwarded;
- local members cannot use international KYC endpoints;
- international members cannot proceed past KYC gates while pending/rejected;
- KYC upload size/type/signature controls;
- duplicate document handling;
- privileged evidence review/download authorization;
- payment state transitions;
- transaction-hash replay attempts;
- RPC outage behaviour;
- settlement idempotency;
- downstream fulfilment retry without duplicate business effects.

## Rollout order

1. Secure registration and routing.
2. International KYC case/evidence workflow.
3. Approved evidence policy and KYC completion gate.
4. Payment intent API.
5. TRON/BSC blockchain verification.
6. Settlement/outbox integration.
7. KasiShares first production integration.
8. Admin operations/observability.
9. Controlled production pilot.
10. Remitano outbound payout adapter, if still required.

## Known unresolved items

See `docs/implementation-issues.md` for the live issue register. The most important unresolved items currently include credential rotation, retirement/hardening of the legacy registration endpoint, the approved international evidence matrix, malware scanning/quarantine for uploaded KYC files, and direct Encore Cloud deployment/runtime access from the current workspace.

( |╲ )
