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

## Rules for adding future issues
1. Assign the next sequential `KIP-###` identifier.
2. Record status, severity and category.
3. Describe the observed problem, not a guessed root cause.
4. Add the required fix or next diagnostic step.
5. Mark an issue RESOLVED only after the fix is verified.

( |╲ ) / (│╲)
