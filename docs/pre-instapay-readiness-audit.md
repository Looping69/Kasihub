# KaSiHUB Pre-InstaPay Integration Readiness Audit

**Reviewed baseline:** `main` at `b8bfbe583cc8386abfc81bc2edac1356c2059605`  
**Review date:** 2026-08-10  
**Purpose:** identify technical debt, broken behavior, trust-boundary gaps and operational prerequisites that should be addressed before KaSiHUB begins direct InstaPay integration.

## Executive decision

**Status: NOT READY for provider integration yet.**

KaSiHUB has useful foundations for provider integration: server-authoritative registration routing, authenticated profile access, idempotent financial workflows, an internal ledger, payment state history, private KYC evidence storage, explicit staging deployment workflows and quality gates. Those patterns should be preserved.

However, InstaPay should not receive production or sandbox authority over identity, KYC state, membership activation or money movement until the P0 readiness blockers below are closed. Most are bounded engineering fixes rather than architectural rewrites.

## Review method and limitations

This review inspected the current GitHub repository across registration, identity/authentication, KYC, membership, network placement, wallets/finance, payments, commerce, shares, frontend registration, deployment workflows, configuration and existing implementation issues.

This is a repository engineering review, **not** a completed Codex Security deep scan. The dedicated deep-scan runtime is not available in this workspace. Live Encore Cloud configuration, deployed databases, edge/proxy security headers and InstaPay's API/webhook specification were also not available here. Provider-specific authentication, signature and endpoint rules must therefore be implemented from approved InstaPay documentation rather than inferred.

## P0 - close before InstaPay integration starts

### 1. Restore and prove a clean backend build baseline

Current `main` contains at least two source-level missing-import defects:

- `encore/domains/network/api.ts` calls `requireAdminAccess()` but imports only `requireProfileAccess`.
- `encore/domains/membership/api.ts` uses `identityDb` and `networkDb` in subscription activation while its resource import currently includes only `auditDb`, `financeDb` and `membershipDb`.

The repository has a strong quality workflow that runs `encore check` and `encore test`, but no successful status/run for the reviewed merge head was surfaced through the available GitHub status interfaces during this audit.

**Gate:** fix the compile defects and require a green frontend + Encore quality-gate run on the exact commit used as the InstaPay integration base.

### 2. Retire or harden the public legacy registration bypass

`POST /registration/start` remains publicly exposed. It accepts trust-bearing values that the secure flow correctly derives server-side, including profile type, membership plan code, KYC creation, and legacy InstaPay verification metadata. It can also create an `instapay` KYC case directly.

The supported web route correctly uses `/registration/secure-start`, which derives profile type, membership plan, KYC rail and payment rail from allowlisted citizenship and membership values. That safe path is not enough while the legacy endpoint remains directly callable.

**Gate:** remove public exposure, remove the endpoint after compatibility review, or make its contract enforce the same server-authoritative policy as `/registration/secure-start`.

**Existing issues:** KIP-001, KIP-005, KIP-006, KIP-010.

### 3. Stop unknown membership plan codes from materialising real plans

`ensureMembershipPlan(code)` currently falls back to `INDIVIDUAL_LOCAL` economics when `code` is unknown, while preserving the unknown caller-provided code when inserting the plan. `subscribeMembership` accepts an arbitrary string plan code and invokes this helper when no active plan exists. The public `membershipPlans` read endpoint also seeds default business plans when the table is empty.

This means business-policy configuration can currently be created implicitly by request/read paths instead of being an explicit approved configuration action.

**Gate:** fail closed on unknown plan codes. Seed/bootstrap policy through migrations or an explicit privileged configuration workflow, not normal member requests or GET endpoints.

### 4. Define one authoritative local KYC/InstaPay state model

Local KYC state is represented in more than one place:

- `kyc_cases.status` in the KYC domain;
- `profiles.status` / `kyc_verified_at`;
- `profiles.instapay_status` / `instapay_verified_at` / `instapay_account_ref`.

The member profile projection currently derives `kycStatus` from `profiles.status`, while `/kyc/status/:profileId` reads `kyc_cases`. This is tolerable before a real provider exists but unsafe once asynchronous provider callbacks begin changing state.

**Gate:** define and implement a single transition contract. Recommended direction:

`InstaPay event received -> immutable provider-event journal -> authenticity/replay checks -> KYC/payment state transition -> profile/read-model projection -> audit/reconciliation`

Provider events must never update several independent status fields ad hoc.

### 5. Resolve local registration UX vs server routing mismatch

Server routing classifies every supported non-international citizenship as local/InstaPay. The registration wizard currently inserts the KaSiPay/InstaPay onboarding step only for `SA_CITIZEN_SA` and `SA_NPO_NGO`.

That leaves `FOREIGN_CITIZEN_SA`, `SA_CIPC_COMPANY` and `SA_SOLE_PROPRIETOR` routed to InstaPay by the server without the equivalent frontend onboarding step.

**Gate:** approve the expected provider journey and required fields for all local classifications, then make the wizard and server policy describe the same flow.

### 6. Design the provider event boundary before making provider calls

No direct InstaPay adapter/event journal is expected to exist yet, and none was found in this review. It must be designed before integration code starts accumulating controller-specific business logic.

The integration boundary must include:

- server-only credentials in managed secret storage;
- a dedicated InstaPay adapter;
- provider authentication/signature verification according to official InstaPay documentation;
- immutable/raw event receipt metadata with safe redaction where required;
- provider event ID/replay protection and idempotent application;
- explicit external-to-internal state mapping;
- retry/backoff, dead-letter/manual replay and outage states;
- polling/reconciliation where callbacks are insufficient;
- correlation from provider references to internal profile/KYC/payment identifiers;
- provider submission separated from provider verification and final internal settlement.

Use the existing USDT payment subsystem's state-machine/idempotency principles as the model, without copying blockchain-specific behavior.

## P1 - harden before a real pilot

### 7. Restrict the generic caller-selected KYC provider path

`POST /kyc/cases` still accepts an arbitrary provider string from an authenticated caller. Dedicated provider flows should own provider selection.

**Action:** constrain or retire the generic member-facing provider selector as InstaPay receives a dedicated path.

**Existing issue:** KIP-007.

### 8. Define manual KYC override policy

Admin KYC APIs can create a `manual` case and approve/reject profiles. That can be operationally valuable, but InstaPay integration needs a documented rule for whether an administrator may override provider KYC, who may do it, the required reason/evidence, and how the override is audited/reconciled.

### 9. Add abuse controls to public identity/provider initiation endpoints

No general application-level rate limiter was found for login, registration or KYC initiation during this review. Endpoint-specific protection exists elsewhere, such as WhatsApp verification resend/attempt controls, but it is not a substitute for auth/provider abuse controls.

**Action:** implement rate limits and anomaly controls for login, registration, KYC initiation, provider account creation/status polling, callback endpoints where applicable, and any provider action that incurs cost or sends communications.

### 10. Remove fixed-email staging admin bypass before provider-connected staging

A hard-coded tester email receives admin/profile access in every non-production Encore environment. This explicitly excludes production, but staging is non-production.

**Action:** remove the bypass for provider-connected staging, or gate it behind an explicit tightly controlled development/test mechanism that cannot grant staging authority by email alone.

### 11. Make finance reporting read authoritative finance state

Operational member wallet reads now use the finance ledger/wallet model, but some admin reporting still reads the legacy `networkDb.wallets.cached_balance` compatibility projection.

**Action:** move financial/admin totals to authoritative `financeDb` state before InstaPay reconciliation depends on those reports. Keep the legacy cache projection only as an explicitly non-authoritative compatibility view until removed.

### 12. Resolve marketplace pool accounting semantics

`commerce/api.ts` returns `poolBenefit = commission * 0.05`, while `finance/api.ts` currently counts the full `SUM(commission)` from marketplace orders as marketplace pool incoming.

**Action:** obtain the approved business definition and encode one source-of-truth policy. Do not choose 5% or 100% by inference.

### 13. Confirm matrix depth semantics before payment-driven activation

Subscription activation places a member into the matrix. Current placement permits parents with `depth < 5`, producing root depth 0 and descendants through depth 5. Existing product language also refers to a 5x6 ecosystem and source material refers to six upline levels.

**Action:** approve exactly what six levels means for placement and earnings before a verified InstaPay payment automatically cements a member's network position.

### 14. Keep provider/ledger money arithmetic in integer minor units

Several legacy commerce/finance paths still accept JavaScript `number`, calculate percentages, and convert using `toFixed`/`Math.round`. Existing exact-cent allocation helpers improve distribution correctness, but direct provider amounts and new split/payable work should use integer minor/atomic units as the authoritative representation.

### 15. Decide whether KaSiHUB will ever ingest InstaPay KYC evidence

Kasihub international KYC uploads are private, size-limited and signature-checked, but currently have no malware scan/quarantine stage.

If InstaPay owns local evidence and KaSiHUB stores only provider references/status, this is not an InstaPay blocker. If documents are proxied or copied through KaSiHUB, scanning/quarantine becomes part of the provider integration threat model.

**Existing issue:** KIP-011.

### 16. Verify web-layer CSRF and security headers at the deployed edge

Next.js configuration in the repository does not define a Content Security Policy, HSTS, frame policy, referrer policy or permissions policy. These may exist at the hosting/proxy layer, which was not inspectable here. Cookie sessions are HttpOnly and SameSite=Lax, but mutating cookie-authenticated routes should have an explicit CSRF/origin strategy.

**Action:** verify the actual deployed edge configuration and document the control rather than assuming the hosting platform supplies it.

### 17. Clean tracked tool-result artifacts

The repository contains tracked `tool-results/read_*.txt` artifacts. They are development residue and create unnecessary repository noise plus a potential future path for accidental sensitive-output retention.

**Action:** inspect, remove if nonessential, and ignore the generated tool-results directory.

## Integration strengths worth preserving

### Server-authoritative routing

`resolveRegistrationPolicy` allowlists citizenship and membership types and fails closed for unknown values. It derives the KYC/payment rails rather than trusting the browser.

### Authenticated ownership boundaries

`requireProfileAccess` and `requireAdminAccess` centralise profile/admin access checks. Provider endpoints should use these boundaries instead of inventing a parallel auth system.

### Idempotent financial operations

Financial workflows already use hashed idempotency keys, request hashes, durable operation states and recorded steps. This is the right model for any provider-triggered mutation.

### Payment state and evidence separation

The international payment flow correctly treats a submitted transaction hash as a claim rather than proof, records state history, prevents hash reuse and verifies server-owned obligations/configuration. The same principle should govern InstaPay: a callback or response is evidence that must be authenticated and mapped, not permission for arbitrary business mutation.

### Private KYC storage and audit patterns

International evidence uses a private object bucket, file-size/type/signature controls, hashes, document records and audit entries. The missing malware stage is known rather than hidden.

### Quality/deployment automation

The repo has frontend lint/type/test/build/browser gates plus Encore `check` and `test`, a staging deploy workflow and a staging contract canary. The immediate problem is restoring a provably green baseline, not inventing CI from scratch.

## Recommended execution order

1. Fix current compile defects and prove the complete quality gate green on `main`.
2. Close KIP-010 and the related legacy registration trust fields.
3. Make membership-plan lookup fail closed and remove request/read-time business-policy creation.
4. Define the local InstaPay KYC/payment/account lifecycle and canonical status model.
5. Align the registration wizard with all local routing classifications.
6. Define the InstaPay adapter/event-journal/replay/reconciliation contract from official provider documentation.
7. Add auth/provider abuse controls and remove the staging tester-admin bypass.
8. Move operational finance reporting off legacy wallet projections and resolve marketplace pool semantics.
9. Confirm matrix placement semantics before provider-confirmed membership activation.
10. Only then add InstaPay credentials and implement sandbox calls/callbacks behind the defined adapter.
11. Run end-to-end sandbox scenarios including duplicate callbacks, delayed callbacks, provider timeouts, rejection/resubmission, duplicate account references, retries, reconciliation and manual-review paths.
12. Promote to production only after credentials, callback URLs, secrets, operational alerts and reconciliation procedures are independently verified.

## Readiness definition

KaSiHUB is ready to begin direct InstaPay integration when:

- the exact integration base commit passes all quality gates;
- no public legacy path can choose KYC/payment policy or submit provider-authoritative metadata;
- unknown plans fail closed;
- one authoritative InstaPay/KYC state machine is documented and implemented;
- every local membership classification has an approved frontend/provider journey;
- provider events have an authenticated, replay-safe, idempotent journal boundary;
- staging access does not depend on a hard-coded admin email;
- rate limits and provider abuse controls exist;
- financial reconciliation reads authoritative ledger/payment state;
- matrix activation semantics are approved;
- provider-specific behavior is implemented from approved InstaPay documentation, not assumptions.

( |╲ ) / (│╲)
