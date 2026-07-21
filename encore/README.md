# Encore Backend

This directory is the real MVP backend entrypoint.

## Endpoints
- `GET /health`
- `POST /registration/start`
- `POST /auth/login`
- `GET /auth/me`
- `GET /profiles/me`
- `GET /dashboard/:profileId`
- `POST /auth/logout`
- `GET /membership/plans`
- `POST /membership/subscribe`
- `POST /payments/activate`
- `POST /ledger/validate`
- `GET /wallets/me/:profileId`
- `GET /matrix/me/:profileId`
- `GET /kyc/cases/:id`
- `POST /kyc/cases`
- `GET /shares/phases`
- `POST /shares/purchase`
- `GET /shares/me/:profileId`
- `GET /admin/audit-logs`
- `GET /admin/config`
- `POST /admin/config/:key/version`
- `GET /admin/members`
- `GET /admin/reports/financial-summary`
- `GET /admin/overview`
- `GET /admin/ledger/transactions`
- `GET /admin/matrix/tree`
- `POST /admin/shares/certificates/:certificateNumber/revoke`
- `POST /admin/shares/certificates/reissue`

All member and administrator operations require the bearer session returned by
`POST /auth/login`. Administrator access is granted through the `admin` role in
the identity database; profile access is limited to the session owner or an
administrator.

## Managed cache

The `application-cache` Encore resource provisions Redis-compatible caching.
Public theme configuration is cached for five minutes, share-phase reads for
15 seconds, and the administrator overview bundle for 15 seconds. Published
theme changes and share inventory mutations invalidate their keys explicitly.
Wallet balances, ledger state, holds, payments, payouts, and mutation decisions
remain database-authoritative and are never accepted from cache.

Author: Klaasvaakie ( |╲ )
