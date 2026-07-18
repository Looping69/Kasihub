# Encore Backend

This directory is the real MVP backend entrypoint.

## Endpoints
- `GET /health`
- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`
- `GET /profiles/me`
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
- `GET /admin/ledger/transactions`
- `GET /admin/matrix/tree`
- `GET /admin/debug/member/:profileId`
- `POST /admin/shares/certificates/:certificateNumber/revoke`
- `POST /admin/shares/certificates/reissue`

All member and administrator operations require the bearer session returned by
`POST /auth/login`. Administrator access is granted through the `admin` role in
the identity database; profile access is limited to the session owner or an
administrator.

Author: Klaasvaakie ( |╲ )
