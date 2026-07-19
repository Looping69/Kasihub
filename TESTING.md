# KaSiHUB test and coverage standard

Author: Klaasvaakie ( |╲ )

## Required gates

- `npm run test:coverage` measures security- and money-bearing Next.js server routes.
- `npm run test:browser` proves session restoration, logout, administrator authority, and CSRF behavior in Chromium.
- `cd encore && encore test -- --coverage` provisions Encore test databases and runs the backend unit and database-contract suites.
- Production dependency audits must report zero moderate-or-higher vulnerabilities.

## Thresholds

The critical Next.js server boundary enforces at least 80% statements, functions, and lines, with 70% branches. The Encore core enforces at least 80% statements, functions, and lines, with 75% branches. These are floors, not targets; financial and authorization modules should remain above 90% as their contracts mature.

Presentation components are intentionally excluded from the unit-coverage denominator. Their behavior belongs in Playwright journeys rather than shallow render tests. Generated UI primitives are not counted.

## Financial acceptance

Percentage coverage never replaces invariant coverage. CI must directly exercise conditional inventory updates, idempotency conflicts, wallet hold capture and release, insufficient funds, balanced ledger entries, unique recipient payouts, deterministic cent allocation, session authority, CSRF rejection, and retry-safe resource creation.
