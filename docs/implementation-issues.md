# Kasihub International Payments & KYC - Implementation Issues Log

This file is the durable issue register for Kasihub payment/KYC implementation. Record technical, security, architecture, integration, data, deployment and tooling issues as they are discovered. Do not rely on ClickUp comments as the only record.

## Status legend
- OPEN - unresolved and affects implementation or rollout
- MITIGATED - temporary control exists, permanent fix still required
- RESOLVED - fixed and verified
- WATCH - not currently blocking, but must be monitored

## Issues

### KIP-001 - Registration KYC routing is client-controlled
**Status:** MITIGATED
**Severity:** High
**Category:** Architecture / Security

The legacy registration endpoint accepts a client-provided `createKyc` flag and hard-codes the provider to `instapay` when KYC is created. This does not support the required split between local InstaPay KYC and international Kasihub KYC.

**Mitigation implemented:** the supported web registration path now uses `/registration/secure-start`, which derives KYC/payment routing server-side from allowlisted citizenship and membership policy. International registrations create `kasihub_international` KYC; local registrations create InstaPay KYC. Hostile client fields are not forwarded by the Next gateway.

**Permanent fix still required:** retire or make the legacy `/registration/start` endpoint non-public so it cannot be called directly as a bypass.

### KIP-002 - Provider credentials were stored in ClickUp task content
**Status:** OPEN
**Severity:** Critical
**Category:** Security / Secrets

Remitano credentials were present in ClickUp task text. They must be treated as exposed regardless of whether they were ever used.

**Required fix:** rotate affected credentials before provider integration. Replacement credentials must live only in managed server-side secret storage and must never be committed to the repository, client code, logs or general-purpose task/document systems.

### KIP-003 - Direct Encore Cloud access is not currently available through this workspace
**Status:** WATCH
**Severity:** Medium
**Category:** Tooling / Deployment

The GitHub repository and Encore application source are accessible and writable, but there is currently no verified direct connector to the Encore Cloud dashboard/account from this environment.

**Impact:** source changes, migrations and deployment configuration can be prepared in GitHub, but live Encore secrets, databases and cloud deployments cannot currently be inspected or changed directly from this ChatGPT workspace.

### KIP-004 - ClickUp comment connector is unreliable/unavailable
**Status:** WATCH
**Severity:** Low
**Category:** Tooling

The ClickUp task-comment action failed repeatedly even though task creation and other ClickUp actions succeeded.

**Mitigation:** keep implementation state and issues in GitHub as the durable technical record, with ClickUp used for project-level tracking when its comment API is available.

### KIP-005 - Exposed registration endpoint accepts derived plan and profile fields
**Status:** MITIGATED
**Severity:** High
**Category:** Security / Business Rules

The legacy Encore `/registration/start` contract accepts `membershipPlanCode` and `profileType`, even though both are deterministic business-policy decisions derived from membership and citizenship classification.

**Mitigation implemented:** `/registration/secure-start` derives profile type and membership plan inside Encore. The Next registration gateway no longer submits those fields.

**Permanent fix:** retire or harden the legacy endpoint so callers cannot directly select derived business-policy values.

### KIP-006 - Registration endpoint accepts client-supplied InstaPay verification metadata
**Status:** MITIGATED
**Severity:** High
**Category:** Security / KYC

The legacy registration contract accepts `instapayAccountRef` and `instapayVerifiedAt`. Verification references and timestamps are provider/backend facts and must never become authoritative merely because a browser submitted them.

**Mitigation implemented:** the supported Next registration route and `/registration/secure-start` do not accept or persist provider verification metadata. Local InstaPay state begins as `PENDING`; international profiles use `NONE` for InstaPay.

**Permanent fix:** retire/harden the legacy endpoint and update verification metadata only from trusted InstaPay/provider verification flows.

### KIP-007 - Generic KYC case endpoint permits caller-selected provider names
**Status:** MITIGATED
**Severity:** Medium
**Category:** Security / KYC

The generic authenticated `/kyc/cases` endpoint accepts a provider string from the caller. Although this does not approve KYC by itself, provider selection is a policy decision and should not be user-controlled.

**Mitigation implemented:** international registration and international member flows use dedicated policy-controlled KYC endpoints with provider `kasihub_international` fixed server-side.

**Required fix:** constrain or retire generic provider selection for member-facing flows once all legitimate KYC providers have dedicated policy-controlled entry points.

### KIP-008 - Payment intent schema blocked safe replacement attempts
**Status:** RESOLVED
**Severity:** High
**Category:** Payments / Data Model

The first payment migration made `order_id` globally unique. That would prevent a new payment intent for an order after a prior intent expired, failed, was rejected or was cancelled.

**Resolution:** replaced the global uniqueness rule with a partial unique index that permits replacement only after terminal non-settlement outcomes while still preventing competing live, confirmed, settling or settled intents. The migration also records intent idempotency/request hashes and gives the outbox unique event keys plus retry metadata.

### KIP-009 - International KYC evidence requirements are not yet defined
**Status:** OPEN
**Severity:** High
**Category:** Compliance / Product Policy

The system can securely route an international member into Kasihub-owned KYC and now supports private evidence upload/review, but the exact required evidence set has not been specified for each international profile type.

**Required decision:** define the mandatory document/evidence matrix for `SA_CITIZEN_ABROAD`, `FOREIGN_CITIZEN_ABROAD` and `INTL_COMPANY`, including beneficial-owner/company requirements, expiry/reverification rules, jurisdiction restrictions, and whether requirements vary by product or transaction value. Once approved, encode it as versioned server-side policy and gate KYC case approval against it.

### KIP-010 - Legacy registration endpoint remains publicly callable
**Status:** OPEN
**Severity:** High
**Category:** Security / API Surface

The supported frontend now uses the safe `/registration/secure-start` coordinator, but the legacy `/registration/start` endpoint remains `expose: true`. A direct API caller could therefore bypass the supported gateway and submit legacy trust-bearing fields.

**Required fix:** make the legacy endpoint non-public, remove it after compatibility review, or refactor its contract to derive the same policy internally. Do not consider registration fully hardened until this bypass is closed.

### KIP-011 - KYC evidence malware scanning/quarantine is not implemented
**Status:** OPEN
**Severity:** Medium
**Category:** Security / File Handling

KYC evidence is private, size-limited, type-allowlisted and validated by file signature, but uploaded PDFs/images are not yet passed through malware scanning or quarantine before an administrator can download them.

**Required fix before broad production rollout:** introduce an asynchronous scan/quarantine state or equivalent trusted malware-analysis control. Admin download/review should be restricted to evidence that has passed scanning, or the operations runbook must explicitly define a compensating control for the pilot.

### KIP-012 - Generic admin KYC approval could bypass international evidence policy
**Status:** RESOLVED
**Severity:** Critical
**Category:** Compliance / Data Integrity

Legacy admin KYC endpoints can update a case status directly. Without a lower-level guard, a future or legacy code path could approve an international case without evaluating the required evidence policy.

**Resolution:** migration `4_international_approval_guard.up.sql` adds a database trigger that rejects a transition to `approved` for `kasihub_international` unless `result_payload.policySatisfied` is true and a non-empty `policyVersion` is recorded. Until KIP-009 is implemented, international approval therefore fails closed regardless of API path.

### KIP-013 - Underpaid payment intents could not expire
**Status:** RESOLVED
**Severity:** Medium
**Category:** Payments / State Machine

The initial state machine allowed an underpaid intent to be retried or manually reviewed, but not to expire or be cancelled. This could leave stale underpaid intents permanently live and block replacement intents.

**Resolution:** `underpaid -> expired` and `underpaid -> cancelled` transitions were added and covered by state-machine tests.

### KIP-014 - Payment obligation foreign key requires eventual validation
**Status:** WATCH
**Severity:** Medium
**Category:** Payments / Migration

The new `payment_intents.order_id -> payment_obligations.id` foreign key is created `NOT VALID` so an unknown preview database with historical branch-only intent rows cannot break the migration. PostgreSQL still enforces the constraint for new/updated rows, but historical rows are not scanned.

**Required follow-up:** after inspecting the deployed payments database and confirming/backfilling any historical orphan intent rows, run `VALIDATE CONSTRAINT fk_payment_intent_obligation` in a follow-up migration.

### KIP-015 - Production receiving/network configuration is not defined
**Status:** OPEN
**Severity:** High
**Category:** Payments / Operations

Payment intent creation deliberately fails closed unless an active receiving configuration exists for the requested network and USDT, including receiving address, approved token contract, decimals, confirmation threshold and intent TTL.

**Required decision/configuration:** approve and enter production values for TRON and BSC. Do not hard-code these values in source. Configuration rotation is admin-only and transactionally audited in the payments database.

### KIP-016 - Global audit database cannot commit atomically with payment configuration
**Status:** MITIGATED
**Severity:** Medium
**Category:** Architecture / Audit

`paymentsDb` and `auditDb` are separate databases, so a receiving-wallet rotation and a global audit-log insert cannot be one atomic transaction. Reporting failure after the payment configuration committed would be misleading; writing the audit first could create a false audit record if the configuration later rolled back.

**Mitigation implemented:** every receiving configuration mutation writes `payment_configuration_events` in the same `paymentsDb` transaction as the configuration change. The global audit database is a secondary mirror; mirror failures are logged and do not invalidate the already-committed authoritative payment configuration.

**Long-term option:** standardize critical cross-domain audit through a durable outbox/event consumer if global audit completeness must be synchronous from an operational perspective.

### KIP-017 - Raw KYC endpoint error mapping needs compiler/runtime verification
**Status:** WATCH
**Severity:** Medium
**Category:** Encore / API Handling

The KYC evidence raw endpoints manually serialize API errors. Encore's documented TypeScript error model exposes structured error codes; the new raw handlers must be verified by CI/runtime to ensure they do not depend on an unsupported error property or raw-handler type assumption.

**Required follow-up:** resolve any PR compiler feedback, use an explicit error-code-to-HTTP mapping if required, and smoke-test unauthorized, invalid-file and not-found responses before rollout.

### KIP-018 - Settlement blueprint omitted split, payable and small-payout aggregation layer
**Status:** OPEN
**Severity:** Critical
**Category:** Financial Architecture / Payouts

The payment blueprint correctly separates inbound verification, settlement and future outbound provider adapters, but it does not yet model the financial ownership layer between settlement and payout. Existing Kasihub product logic already contains commissions, pool contributions and distribution allocations, so continuing without a shared model would encourage hard-coded split logic and potentially one external provider transaction per small earning.

**Required architecture:** adopt `Payment -> Settlement -> Allocation -> Ledger -> Payable -> Payout Aggregation -> Outbound Payout Provider -> Reconciliation` as the canonical financial flow. Settled transactions must generate balanced, versioned internal allocations. Small earnings accumulate in ledger-backed payable balances. External payout workflows reserve eligible value, submit it through a replaceable provider adapter and reconcile success/failure without altering the original earnings.

**Required executive decisions:** approve split percentages/recipient rules by product, payout thresholds/frequency, fee ownership, payout limits/manual-review rules, local InstaPay payout destination model, international payout provider/destination model, tax/withholding treatment and pool distribution policy.

**Implementation reference:** `docs/settlement-splits-payouts-architecture.md`.

### KIP-019 - Current main backend build baseline contains unresolved source references
**Status:** OPEN
**Severity:** Critical
**Category:** Build Integrity / Encore

Repository inspection of `main` at `b8bfbe583cc8386abfc81bc2edac1356c2059605` found source references that are not imported in their modules: `encore/domains/network/api.ts` calls `requireAdminAccess()` while importing only `requireProfileAccess`, and `encore/domains/membership/api.ts` uses `identityDb` and `networkDb` while its resource import currently contains only `auditDb`, `financeDb` and `membershipDb`.

The repository has quality gates for `encore check` and `encore test`, but no successful run/status for the reviewed merge head was surfaced by the available GitHub status interfaces during the readiness audit.

**Required fix:** correct the source imports and require a green frontend and Encore quality-gate run on the exact commit selected as the InstaPay integration base. Do not begin provider integration on an unverified build baseline.

### KIP-020 - Unknown membership plan codes can materialise fallback business plans
**Status:** OPEN
**Severity:** High
**Category:** Business Rules / Data Integrity

`ensureMembershipPlan(code)` falls back to `INDIVIDUAL_LOCAL` economics when an unknown code is supplied but inserts the caller-provided code. `subscribeMembership` accepts a general string `planCode` and invokes this helper when the requested active plan does not exist. The public membership-plan read path also seeds default plans when the table is empty.

**Impact:** normal request/read paths can implicitly create authoritative business-policy records instead of failing closed on unapproved plan codes.

**Required fix:** allow only approved plan identifiers; make unknown codes fail closed; move bootstrap/seed behavior to migrations or an explicit privileged configuration workflow; keep GET endpoints read-only.

### KIP-021 - Local InstaPay/KYC state has multiple authorities without a provider-event transition model
**Status:** OPEN
**Severity:** Critical
**Category:** KYC Integration / State Management

Local KYC/provider state is represented in `kyc_cases.status`, profile status/KYC timestamps, and separate InstaPay status/reference fields on the profile. The member profile projection derives KYC status from profile activation state, while the KYC status endpoint reads KYC cases.

**Impact:** once asynchronous InstaPay callbacks begin changing state, independent writes can produce conflicting KYC, account and profile truth.

**Required fix:** define one canonical state machine and event flow before receiving provider callbacks. Provider events should be durably journalled and authenticated, replay checked, applied idempotently to the authoritative KYC/payment state, then projected into profile-facing fields and audit/reconciliation views.

### KIP-022 - Local registration UX does not cover every server-routed InstaPay classification
**Status:** OPEN
**Severity:** High
**Category:** Product / KYC Integration

Server routing sends every supported non-international citizenship classification to the local InstaPay rail. The registration wizard currently inserts the KaSiPay/InstaPay onboarding step only for `SA_CITIZEN_SA` and `SA_NPO_NGO`.

**Impact:** `FOREIGN_CITIZEN_SA`, `SA_CIPC_COMPANY` and `SA_SOLE_PROPRIETOR` can enter an InstaPay-backed server flow without the equivalent frontend provider onboarding experience or confirmed required data collection.

**Required decision/fix:** approve the InstaPay journey and required fields for every local classification, then make frontend flow and server routing describe the same policy.

### KIP-023 - Marketplace pool accounting uses conflicting commission semantics
**Status:** OPEN
**Severity:** High
**Category:** Financial Integrity / Commerce

Marketplace order logic returns a `poolBenefit` equal to 5% of the calculated order commission. Finance pool reporting currently counts the full `SUM(commission)` from marketplace orders as marketplace-pool incoming.

**Impact:** pool liabilities and reporting can materially differ depending on which code path is treated as authoritative.

**Required decision/fix:** obtain the approved business definition for marketplace commission and pool allocation, encode it in one versioned policy source, and make commerce posting plus finance reporting reconcile to that source. Do not infer whether 5% or 100% is intended.

### KIP-024 - Fixed-email tester admin bypass applies to provider-connected staging
**Status:** OPEN
**Severity:** High
**Category:** Security / Environment Access

`hasTesterAdminAccess` grants admin/profile access to a hard-coded tester email in every environment except production. That includes staging and ephemeral environments.

**Impact:** a provider-connected staging environment could grant broad administrative authority based on email identity rather than an explicit database role or tightly controlled environment permission.

**Required fix before InstaPay staging:** remove the bypass from provider-connected staging, or replace it with an explicit development/test-only control that cannot grant staging authority by email alone.

### KIP-025 - General auth/registration/provider abuse controls are not evident in the application layer
**Status:** OPEN
**Severity:** High
**Category:** Security / Abuse Prevention

The readiness review did not find a general application-level rate limiter for login, registration or KYC initiation. Some endpoints have narrow controls, such as WhatsApp verification resend and attempt limits, but those do not protect identity/provider entry points.

**Required fix before provider pilot:** add rate limits and appropriate anomaly/cost controls to login, registration, KYC/provider initiation, account creation/status polling, and provider-facing endpoints according to their threat and provider cost model. Verify whether the deployment edge supplies any additional controls and document them.

### KIP-026 - Matrix depth semantics are unresolved before payment-driven placement
**Status:** OPEN
**Severity:** High
**Category:** Network / Business Rules

Membership activation places the profile into the matrix. Current placement selects parents with `depth < 5`, producing a root at depth 0 and descendants through depth 5. Product/source language also refers to a `5x6` ecosystem and six upline levels.

**Impact:** an automated InstaPay-confirmed membership activation could permanently place members under hierarchy semantics that have not been reconciled with the intended six-level earning/placement model.

**Required decision/fix:** define whether the six levels include or exclude the member/root and distinguish placement depth from payout/upline depth. Encode tests for the approved interpretation before provider-confirmed payments trigger placement.

### KIP-027 - Admin financial reporting still reads the legacy wallet compatibility projection
**Status:** OPEN
**Severity:** Medium
**Category:** Financial Reporting / Data Integrity

Authoritative member wallet operations now use `financeDb` wallet/ledger state, but some admin reports still aggregate `networkDb.wallets.cached_balance`, which is maintained as a compatibility projection.

**Impact:** provider reconciliation or operations reporting can show stale totals if the compatibility projection lags or fails to update after an authoritative finance transaction.

**Required fix:** move operational/admin financial reporting to authoritative finance ledger/wallet data. Mark legacy wallet values as non-authoritative until the compatibility layer is removed.

### KIP-028 - Generated tool-result artifacts are tracked in the repository
**Status:** WATCH
**Severity:** Low
**Category:** Repository Hygiene / Data Retention

The repository contains tracked `tool-results/read_*.txt` files. Generated diagnostic/tool output is not application source and creates unnecessary repository noise plus a potential future path for accidental sensitive-output retention.

**Required follow-up:** inspect whether any tracked tool-result file is required for tests or documentation. If not, remove the artifacts and ignore the generated directory.

### KIP-029 - Applicant journey hydration can overwrite an existing reservation and expose the wrong CTA
**Status:** OPEN
**Severity:** Critical (P0)
**Category:** Frontend / State Authority / Hydration Ordering

During async hydration on the applicant portal, an existing confirmed reservation state (e.g. "CONTINUE TO SECURE WEBPAY CHECKOUT" with locked payment rail) briefly renders, but subsequent asynchronous resolution of application/draft continuation steps recalculates the UI and falls back to rendering the pre-reservation view ("CREATE RESERVATION"). This sends the applicant backwards into a dead-end state immediately before payment.

**Required fix:** enforce a single authoritative derived journey state. Render no transactional CTA until reservation, application, KYC, and payment state have all resolved. When an active reservation exists, prohibit rendering `CREATE RESERVATION` unless the existing reservation is confirmed cancelled/expired by the backend and a new reservation is explicitly permitted. Fix in coordination with reservation credential recovery.

## Rules for adding future issues
1. Assign the next sequential `KIP-###` identifier.
2. Record status, severity and category.
3. Describe the observed problem, not a guessed root cause.
4. Add the required fix or next diagnostic step.
5. Mark an issue RESOLVED only after the fix is verified.

( |╲ ) / (│╲)
