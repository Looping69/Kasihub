# Kasihub International Payments & KYC - Implementation Issues Log

This file is the durable issue register for the `feature/international-kyc-usdt-payments` implementation. Record technical, security, architecture, integration, data, deployment and tooling issues as they are discovered. Do not rely on ClickUp comments as the only record.

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

## Rules for adding future issues
1. Assign the next sequential `KIP-###` identifier.
2. Record status, severity and category.
3. Describe the observed problem, not a guessed root cause.
4. Add the required fix or next diagnostic step.
5. Mark an issue RESOLVED only after the fix is verified.

( |╲ )
