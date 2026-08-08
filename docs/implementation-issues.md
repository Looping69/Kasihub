# Kasihub International Payments & KYC - Implementation Issues Log

This file is the durable issue register for the `feature/international-kyc-usdt-payments` implementation. Record technical, security, architecture, integration, data, deployment and tooling issues as they are discovered. Do not rely on ClickUp comments as the only record.

## Status legend
- OPEN - unresolved and affects implementation or rollout
- MITIGATED - temporary control exists, permanent fix still required
- RESOLVED - fixed and verified
- WATCH - not currently blocking, but must be monitored

## Issues

### KIP-001 - Registration KYC routing is client-controlled
**Status:** OPEN
**Severity:** High
**Category:** Architecture / Security

Current registration accepts a client-provided `createKyc` flag. When KYC is created, the backend hard-codes the provider to `instapay`. This allows routing decisions that should be server-authoritative to originate from the client and does not support the required split between local InstaPay KYC and international Kasihub KYC.

**Required fix:** derive KYC and payment routing server-side from citizenship/profile policy. International categories must automatically route to Kasihub KYC; eligible local categories must route to InstaPay.

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

## Rules for adding future issues
1. Assign the next sequential `KIP-###` identifier.
2. Record status, severity and category.
3. Describe the observed problem, not a guessed root cause.
4. Add the required fix or next diagnostic step.
5. Mark an issue RESOLVED only after the fix is verified.

( |╲ )
