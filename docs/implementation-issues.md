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

**Mitigation implemented:** the Next registration gateway now obtains a server-derived registration policy from Encore. Local registrations request InstaPay KYC; international registrations create a dedicated Kasihub international KYC case after account creation. International KYC eligibility and provider selection are enforced by a dedicated backend endpoint.

**Permanent fix still required:** refactor the exposed Encore `/registration/start` endpoint so it derives KYC routing internally and no longer accepts `createKyc` as a trust-bearing request field.

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
**Status:** OPEN
**Severity:** High
**Category:** Security / Business Rules

The exposed Encore `/registration/start` contract accepts `membershipPlanCode` and `profileType`, even though both are deterministic business-policy decisions derived from membership and citizenship classification.

**Mitigation implemented:** the Next registration gateway now requests these values from Encore's server-owned routing policy and no longer derives them from browser-selected fields.

**Required fix:** remove these trust-bearing fields from the exposed registration contract and derive them inside the Encore registration coordinator before persistence or pricing decisions.

### KIP-006 - Registration endpoint accepts client-supplied InstaPay verification metadata
**Status:** MITIGATED
**Severity:** High
**Category:** Security / KYC

The legacy registration contract accepts `instapayAccountRef` and `instapayVerifiedAt`. Verification references and timestamps are provider/backend facts and must never become authoritative merely because a browser submitted them.

**Mitigation implemented:** the Next registration gateway no longer forwards InstaPay verification metadata from the browser.

**Permanent fix still required:** remove or ignore these fields in the Encore registration endpoint and update them only from trusted InstaPay/provider verification flows.

### KIP-007 - Generic KYC case endpoint permits caller-selected provider names
**Status:** MITIGATED
**Severity:** Medium
**Category:** Security / KYC

The generic authenticated `/kyc/cases` endpoint accepts a provider string from the caller. Although this does not approve KYC by itself, provider selection is a policy decision and should not be user-controlled.

**Mitigation implemented:** international registration now uses `/kyc/international/cases`, which verifies the persisted profile is international and hard-codes provider `kasihub_international` server-side.

**Required fix:** constrain or retire generic provider selection for member-facing flows once all legitimate KYC providers have dedicated policy-controlled entry points.

## Rules for adding future issues
1. Assign the next sequential `KIP-###` identifier.
2. Record status, severity and category.
3. Describe the observed problem, not a guessed root cause.
4. Add the required fix or next diagnostic step.
5. Mark an issue RESOLVED only after the fix is verified.

( |╲ )
