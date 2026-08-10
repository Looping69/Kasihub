# Kasihub Demo Database Surface Audit

Author: Klaasvaakie ( |╲ )

## Purpose

The current Kasihub database contains mock/test data and is safe to expose through the Demo experience. The Demo therefore should exercise the normal authenticated read paths and display database-backed values rather than maintain a second hard-coded presentation dataset.

This document records where the Demo currently reads authoritative application data, where adapters still replace database values with placeholders, and what must be corrected before the Demo can be described as fully database-backed.

## Demo principle

For the current mock-data environment:

`Demo login -> normal Encore authentication -> normal member read APIs -> database-backed UI`

The Demo account is a real configured application account. `src/app/api/auth/login/route.ts` resolves the configured Demo credentials and authenticates through Encore `/auth/login` and `/profiles/me`. There is no reason for downstream read surfaces to fabricate financial values after that point.

When production data is introduced, Demo write safety should be handled separately through permissions/sandboxing. Read truth and write safety must not be conflated.

## Corrected in `fix/demo-database-backed-dashboard`

### Dashboard financial values

The previous Next dashboard adapter called the real Encore dashboard bundle and then replaced several values with hard-coded zeros or synthetic data.

Corrected behaviour:
- authoritative wallet balance remains distinct from earnings;
- all-time, daily, current-week and current-month earnings are derived from real ledger-backed wallet transactions;
- legacy opening balances are not presented as earnings;
- 14-day earnings trend is derived from transaction dates;
- earnings breakdown is derived from transaction types;
- member pool distributions are read from finance data;
- member Roots Bank holding and Pioneer eligibility are read from the Roots Bank domain;
- the R7,500 monthly tax-notification threshold is used for dashboard notification state;
- dashboard reads remain authenticated and profile-scoped.

### Member finance summary

A read-only member finance summary endpoint exposes only the authenticated member's own `pool_distributions` data. It does not invoke or depend on the legacy admin pool distribution write path.

## Already database-backed

### Demo authentication
- configured Demo account credentials authenticate through the normal backend auth flow;
- the resulting member profile is loaded from Encore;
- the normal session cookie is used afterward.

### Marketplace
The Marketplace member view reads products and recent member orders from the commerce database through the normal API.

### Wallet transaction list
The member wallet API reads the authoritative finance wallet balance and ledger transactions.

### Core dashboard bundle
Encore's `/dashboard/:profileId` bundle already reads profile, wallet, matrix, KasiShares certificates and share phases from their respective domains.

## Remaining frontend/data-surface gaps

### 1. Eco-System member display metadata
**Status: OPEN**

`src/app/api/matrix/route.ts` reads real matrix nodes but fabricates presentation metadata for those nodes, including generated profile numbers, generic `Member` names, `ZA` country and `ACTIVE` subscription status.

**Required fix:** resolve the visible member/profile metadata from authoritative identity/membership records while preserving access-control/privacy requirements.

### 2. Eco-System commission display uses a stale schedule
**Status: OPEN / FINANCIAL POLICY SENSITIVE**

The matrix adapter currently calculates display commissions using `[20, 10, 8, 5, 3, 1]`. The approved R53 six-level economic schedule is R13/R11/R11/R9/R6/R3.

This must not be silently changed into a payout implementation because the authoritative hierarchy source is still unresolved in KIP-019 on the split-engine workstream. The UI must ultimately display approved policy data rather than a separate hard-coded schedule.

### 3. Shares adapter contains placeholder values
**Status: OPEN**

`src/app/api/shares/route.ts` currently returns placeholder values for fields including sold shares, Aureus values and daily profit-share metrics where a database-backed source is not yet wired.

**Required fix:** for each field, either wire an authoritative source or clearly label the value unavailable. Do not represent an unavailable value as a measured zero.

### 4. Public landing statistics are hard-coded
**Status: OPEN**

The landing page currently contains fixed marketing statistics such as active members, shares sold, KasiPool paid out and Pioneer spots left.

**Required decision:** either source these from approved public aggregate endpoints or label/remove them. Public statistics must not look live when they are static copy.

### 5. Mobile notification count is hard-coded
**Status: OPEN**

The mobile dashboard notification badge displays a literal count rather than an authoritative notification count.

**Required fix:** wire the notifications source or omit the count until one exists.

### 6. Aureus dashboard values are not yet sourced
**Status: OPEN**

The dashboard currently exposes the Aureus portfolio shape but no authoritative database projection has been identified in the current dashboard bundle.

**Required fix:** connect the actual Aureus holding source if it exists, or display the feature as unavailable rather than treating missing integration as a factual zero.

## Acceptance criteria for a fully database-backed Demo

1. Demo authentication uses the normal authenticated backend flow.
2. Every numeric member/account value displayed as factual is sourced from an authoritative API/database projection.
3. No missing integration is silently rendered as a factual zero unless zero is confirmed by the source.
4. No fake trend percentage, fake notification count or synthetic member identity is presented as current data.
5. Financial labels distinguish wallet balance, earnings, pool allocations and share value.
6. Policy-sensitive displays use versioned approved policy rather than duplicated frontend constants.
7. Demo writes are separately restricted or sandboxed before production data is introduced.
8. Desktop and mobile surfaces use the same authoritative contracts.

## Current conclusion

The Demo authentication architecture is already correct. The main defect is in presentation/adaptor code that overwrites or supplements real backend data with placeholders. The dashboard financial path is the first correction; the remaining surfaces above should be closed systematically.

( |╲ ) / (│╲)
