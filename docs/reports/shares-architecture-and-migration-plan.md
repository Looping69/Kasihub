# KaSiHub Shares Architecture and Migration Plan

**Status:** Critical vertical slice implemented on `Klaasvaakie/presale-issuance-v2`; remaining migration phases are explicitly listed below
**Prepared:** 2026-08-31
**Repository baseline:** `ec4f066563e8a351831a40b5c542e2ff6a6ca161`
**Source analysis:** `output/pdf/kasihub-shares-page-and-journey-api-map.pdf`

## Executive decision

Do not scrap the current shares presale system.

The existing system already contains the expensive and safety-critical controls worth preserving:

- invitation-only access;
- separate applicant and ecosystem sessions;
- KYC and declarations;
- server-derived pricing;
- signed settlement callbacks and canonical transaction verification;
- idempotent reservation and incorporation controls;
- durable presale, payment and shareholder evidence;
- distinctive-number allocation and certificate integrity snapshots.

The correct strategy is a **strangler migration**: build the stronger architecture beside the existing implementation, compare results, move traffic through controlled feature flags, and retire the old paths only after production parity is proven.

## Implementation outcome - 2026-08-31

The critical presale issuance slice described by this document is now implemented:

- `encore/domains/shares/issuance.ts` is the single authority for presale purchase, inventory, range, sequence, certificate snapshot and integrity writes;
- individual settlement and administrator batch incorporation both call that command;
- presale settlement writes `share_issuance_requested` to `presale_outbox` in the settlement transaction;
- issuance writes its completion to `shares_outbox` in the shares transaction;
- completion is recorded idempotently in `presale_inbox` before the order becomes incorporated;
- retries use the stable operation key `presale:<orderReference>`;
- `/shares/portfolio/me` derives the shareholder from the authenticated ecosystem session and returns `shareholder-portfolio.v2` with exact money strings;
- `/api/member/shares` no longer accepts a browser-selected member ID;
- the member page labels historical acquisition cost and paid issue price instead of presenting issue price as current market value;
- issued presale certificate printing opens the holder-authorised sealed PDF route;
- a non-production E2E harness creates its own isolated invitation/KYC fixture and proves reservation through certificate PDF and public verification.

The full test method is documented in `docs/reports/presale-e2e-runbook.md`.

This is not yet permission to clear the production ledger. The one-time test-ledger reset remains gated on deployment, production-schema verification, a production-like non-money run, backup, exact data-scope audit and final explicit approval.

## Current architectural weaknesses

### 1. Browser-selected member identity

The member page currently sends a `memberId` to `/api/shares`. Encore rechecks profile access, which prevents straightforward cross-profile access, but the browser should not select the portfolio subject at all.

The authenticated session should resolve the shareholder identity server-side.

### 2. Financial projections outside the shares authority

The Next/frontend adapter combines phase and certificate data, converts decimal values into JavaScript numbers, derives sold shares, and calculates a value using the current issuance price.

For private shares, the current issuance price is not automatically a fair-market valuation. The product should show historical acquisition cost and current offer price separately.

### 3. Fragmented page contract

The member page depends on separately shaped responses for phases, certificates and presale campaigns. Domain meaning is duplicated across Encore, Next route handlers and React.

### 4. Duplicated issuance logic

Individual incorporation and batch incorporation independently implement inventory deduction, purchase creation, certificate creation, distinctive-range allocation and certificate numbering. These paths can drift.

### 5. Cross-database commit gap

The shares ledger transaction commits separately from the presale order update. Idempotency makes recovery possible, but a process interruption can temporarily leave the two databases disagreeing.

### 6. Multiple certificate authorities

Sealed PDFs coexist with browser-generated printable HTML. Presale, administrative reissue and legacy wallet paths also use different certificate-number protocols.

## Target architecture

Keep the system as an Encore modular monolith. Do not introduce unnecessary microservices.

```text
Member browser
    |
    +-- GET /api/member/shares
    |       |
    |       +-- GET /shares/portfolio/me
    |               |
    |               +-- Portfolio Query Service
    |                       |
    |                       +-- Shares ledger/read model
    |
    +-- GET /api/member/share-offers
            |
            +-- Eligible Offer Query
                    |
                    +-- Presale campaign/invitation state

Provider webhook
    |
    +-- Settlement transaction + outbox event
            |
            +-- Share Issuance Worker
                    |
                    +-- One authoritative shares transaction
                    |     - purchase
                    |     - certificate
                    |     - distinctive range
                    |     - certificate sequence
                    |     - integrity snapshot
                    |
                    +-- Issuance-completed event
                            |
                            +-- Presale order marked incorporated
                            +-- Certificate artifact generated
```

## Portfolio query architecture

### New member API

Replace:

```http
GET /api/shares?memberId=<browser-selected-profile>
```

with:

```http
GET /api/member/shares
GET /shares/portfolio/me
```

The session identifies the shareholder. No profile ID travels from the browser.

### Versioned response contract

```json
{
  "schemaVersion": "shareholder-portfolio.v2",
  "asOf": "2026-08-31T12:00:00Z",
  "ledgerRevision": "1842",
  "summary": {
    "issuedShares": 10,
    "paidShares": 5,
    "bonusShares": 5,
    "acquisitionCost": {
      "amount": "125.00",
      "currency": "USD"
    }
  },
  "holdings": [],
  "certificates": [],
  "capabilities": {
    "canApplyForMoreShares": true,
    "applicationUrl": "/presale"
  }
}
```

Money must remain an exact decimal string or approved fixed-point representation. It must not be passed through JavaScript floating-point arithmetic.

### Critical and optional data

Treat portfolio ownership and private offers as separate failure domains:

- **Critical:** holdings, acquisition history and certificates. If unavailable, show a bounded portfolio error and no estimates.
- **Optional:** current eligible/private offers. If unavailable, existing ownership must still render.

### Financial terminology

Display:

- legally issued shares;
- paid shares;
- bonus shares;
- historical acquisition cost;
- certificate count and status;
- current private offer price;
- application or issuance state.

Do not call `shares x current issuance price` a current value. If the business insists on showing it, label it explicitly as:

> Illustrative amount at the current issuance price - not a market valuation.

Return explicit inventory metrics instead of deriving ambiguous values:

- `issuedShares`;
- `reservedShares`;
- `availableShares`;
- `paidShares`;
- `bonusShares`;
- `revokedShares`.

## Single share issuance authority

Create one internal command used by every issuance path:

```ts
issueShares({
  operationId,
  source,
  sourceReference,
  profileId,
  phaseNumber,
  paidShares,
  bonusShares,
  acquisitionAmount,
  currency,
})
```

Inside one shares database transaction it must:

1. enforce operation idempotency;
2. validate the authorised phase and inventory;
3. allocate one non-overlapping distinctive range;
4. allocate the phase-local certificate sequence;
5. write the share purchase;
6. write the certificate;
7. seal the immutable integrity snapshot;
8. write an issuance-completed outbox event;
9. commit all shares-ledger writes atomically.

Presale incorporation, administrative issuance/reissue and any future authorised issuance path must call this command. No other module should write purchases, certificate ranges or certificate numbers directly.

## Outbox-based incorporation workflow

The provider webhook should persist settlement evidence quickly and should not perform the full incorporation workflow inside the provider request.

### Proposed sequence

1. Validate the provider signature and canonical settlement evidence.
2. In one presale transaction, mark the order settled and write `share_issuance_requested` to `presale_outbox`.
3. A worker delivers the event using an idempotency key such as `presale:<orderReference>`.
4. The shares consumer records the message in `shares_inbox` and calls `issueShares` once.
5. The shares transaction writes `share_issuance_completed` to `shares_outbox`.
6. Presale consumes the completion and marks the order incorporated.
7. Reconciliation monitors old pending events, duplicate deliveries and projection lag.

### Required append-only tables

- `presale_outbox`;
- `shares_inbox`;
- `shares_outbox`;
- `presale_inbox`.

Messages must have stable IDs, correlation IDs, source references, schema versions, attempt counts and processed timestamps.

## Certificate architecture

The ledger certificate remains the authority. The rendered PDF is an immutable artifact derived from its sealed snapshot.

At issuance:

1. write and seal the certificate ledger record;
2. generate the approved PDF asynchronously from that immutable snapshot;
3. store the PDF in the private bucket;
4. record its SHA-256 hash, object key and artifact state;
5. serve it only after holder or administrator authorisation;
6. expose bounded public verification through the verification ID.

Remove browser-generated certificate HTML after every historical certificate has an authoritative download route.

Unify certificate numbering, reissue, revocation and replacement under one documented protocol. Existing historical references must be preserved, not silently renumbered.

## Page boundaries

Keep the three journeys separate:

| Surface | Purpose | Authority |
|---|---|---|
| Member shares page | Read-only ownership, acquisition history and certificates | Ecosystem session and shares ledger |
| `/shares/account` | Applicant continuation and issued-shareholder access before ecosystem conversion | Presale-scoped session |
| `/presale/[invite]` | Private invitation, application, KYC, reservation and settlement | Invitation plus presale authority |

They may share design components and terminology, but they must not share client-side authority or become one giant stateful page.

## Migration plan

### Phase 0 - Freeze and audit

- Pause new non-critical shares features.
- Produce a read-only reconciliation baseline covering orders, settlements, purchases, certificates and ranges.
- Verify one incorporated order maps to one purchase and expected certificate.
- Verify no distinctive ranges overlap.
- Verify paid plus bonus equals certificate totals.
- Verify one provider transaction cannot settle multiple orders.
- Record counts and hashes for later comparison.

**Rollback:** none required; no production behaviour changes.

### Phase 1 - Portfolio v2 in shadow mode

- Add `/shares/portfolio/me`.
- Add a versioned contract and backend calculations.
- Call v1 and v2 server-side for selected accounts.
- Log bounded field-level differences without exposing private data.
- Keep v1 user-visible until parity is clean.

**Rollback:** disable shadow comparison.

### Phase 2 - Member page cutover

- Build a clean `SharesPortfolioView` against v2 only.
- Enable it for internal accounts first.
- Expand to selected real shareholder accounts.
- Move to a percentage canary and finally all members.
- Keep optional offers independent from critical holdings.

**Rollback:** switch the feature flag back to the existing SharesView.

### Phase 3 - Consolidate issuance

- Extract `issueShares`.
- Route individual and batch incorporation through it.
- Add concurrency, idempotency, range and certificate tests.
- Remove duplicated issuance SQL only after parity is proven.

**Rollback:** retain the old incorporation entry points until the command passes reconciliation.

### Phase 4 - Outbox workflow

- Add outbox/inbox migrations.
- Run the workflow first in observation mode without issuing shares.
- Compare its intended decisions against the existing incorporation process.
- Enable authoritative event processing only after parity.

**Rollback:** stop the workers and continue the existing idempotent process.

### Phase 5 - Certificate consolidation

- Add immutable artifact state and private object storage.
- Backfill authoritative artifacts from sealed snapshots.
- Verify hashes and holder access.
- Remove browser-print certificates.
- Retire legacy number generators after a documented historical strategy.

**Rollback:** ledger certificates remain valid; artifact generation can be retried.

### Phase 6 - Retire version one

Remove v1 only when:

- portfolio comparisons are clean;
- a real authenticated shareholder journey passes;
- no settled payment lacks an issuance outcome;
- no certificate or range inconsistency remains;
- duplicate delivery and retry tests pass;
- holder-specific downloads and public verification pass;
- production reconciliation has no unexplained backlog.

## Implemented first release slice

This branch deliberately combines the portfolio correction with the minimum issuance correction required to make a real E2E proof possible:

1. `/shares/portfolio/me` and `shareholder-portfolio.v2`;
2. session-derived portfolio ownership;
3. exact backend acquisition calculations;
4. `/api/member/shares` with optional phase data isolated from critical holdings;
5. one presale issuance authority;
6. durable presale outbox, shares completion outbox and presale inbox;
7. idempotent individual and batch incorporation;
8. non-production E2E setup and settlement harness;
9. applicant portal, PDF and public verification assertions.

The slice does not change provider signature verification, real payment pricing, invitation-only production access, KYC policy, authorised phase numbering, existing production ownership, or the production ledger.

Still outstanding before version-one retirement:

- publish and monitor completion events independently rather than relying on immediate delivery plus the five-minute worker;
- store generated certificate artifacts in private object storage with a recorded artifact hash;
- consolidate legacy wallet and administrator reissue numbering;
- remove the malformed-fixture HTML certificate fallback after historical artifact coverage is proven;
- add shadow comparison telemetry and production canary controls;
- deploy migrations and run the release gates against the production-like environment.

## Restart criteria

A full ledger reconstruction should be considered only if the audit proves that ownership cannot be recovered safely, for example:

- overlapping distinctive ranges;
- duplicate settlements with conflicting owners;
- certificates with no recoverable purchase or incorporation evidence;
- contradictory records that cannot be resolved through provider, order and ledger evidence.

Even then, preserve every original record in an immutable legacy evidence set and build a reconciled successor ledger. Do not erase history or start from an empty database.

## Release gates

Completion requires independent evidence for:

- exact Git revision;
- frontend deployment;
- Encore deployment;
- database migrations;
- authenticated portfolio journey;
- provider settlement handling;
- issuance write and retry behaviour;
- certificate artifact download;
- public verification;
- reconciliation backlog and operational alerts;
- documented rollback.

No frontend build, provider badge, payment-return page or generated PDF proves the entire shares journey by itself.
