# KaSiShares reservation backend handoff

The KaSiShares frontend is ready for an approved reservation service. No backend integration has been implemented.

Wimpie needs to provide and approve:

- Authenticated `POST /share-reservations` with full name, email, optional phone, share quantity, campaign/version ID and acknowledgement version.
- Server-authoritative share price, allocation limits, campaign availability and settlement quote.
- Idempotency keys so repeated submissions cannot create duplicate reservations.
- A short-lived reservation/payment window with an immutable reservation reference.
- Approved USDT network, receiving-address delivery and exact-amount calculation. Never hardcode wallets in frontend code.
- Blockchain confirmation monitoring and a state model such as `created`, `awaiting_payment`, `detected`, `confirming`, `settled`, `expired`, `cancelled` and `manual_review`.
- Separation between reservation/payment evidence and the legal share ledger or certificate issuance process.
- Eligibility, jurisdiction, KYC/AML, sanctions and investor-classification gates supplied by approved legal/compliance owners.
- Rate limiting, bot protection, audit events, encrypted personal data, retention controls and restricted staff access.
- Admin reconciliation, manual review, refund/exception handling, pause switch and complete campaign kill switch.
- Approved transactional email/SMS templates and delivery provider integration.
- Monitoring for reservation errors, payment mismatch, delayed confirmations and provider outages.

Before integration, legal/compliance must supply the issuer name, share class, subscription agreement, acknowledgement wording, eligibility rules, campaign dates and final risk disclosures.

## Section 10 phased application contract

The frontend now presents the supplied Solidus Class B Share Investor Application in six applicant-facing phases. The production service must persist drafts after each phase without treating a draft as a submitted application.

Required applicant payload groups:

1. `investor`: applicant type (`individual`, `company`, `trust`), legal names/entity name, surname when applicable, ID/passport or registration/authority number, email, mobile, tax number, physical/registered address, and authorised-representative fields for companies/trusts.
2. `investment`: selected funding phase (1-10), requested shares, server-authoritative price per share, USD total and optional ZAR equivalent. Never trust totals calculated by the browser.
3. `funds_and_banking`: source of funds, other-source detail, fund owner, account holder, bank, branch, account number, account type and optional SWIFT code. Encrypt banking and identity fields at rest and restrict operational access.
4. `documents`: applicant-type-specific KYC/FICA requirements, upload status, secure object identifiers, checksum, document category, scan result and review state. Files must use signed uploads, type/size validation, malware scanning and short-lived access URLs.
5. `declarations`: immutable acknowledgement version plus individual timestamps for suitability, beneficial-owner, FATCA/CRS and AML confirmations; represented-person details when applicable.
6. `signature`: investor name, date, place, declaration version, consent timestamp, IP/device audit metadata subject to approved privacy wording, and the electronic-signature provider reference when one is selected.

Suggested endpoints:

- `POST /investor-applications` creates an idempotent draft and returns `applicationId`, `version`, required-document rules and expiry.
- `PATCH /investor-applications/{id}/phases/{phase}` validates and saves one phase using optimistic versioning.
- `POST /investor-applications/{id}/uploads` returns a signed upload instruction for an approved document category.
- `GET /investor-applications/{id}` returns the applicant-safe draft and per-phase completion state.
- `POST /investor-applications/{id}/submit` performs final server validation, locks the submitted version and queues compliance review.

Internal Section 12 EXCO approval must live in an authenticated staff workflow, never in the public applicant UI. It requires role separation, reviewer identity, comments, additional-information requests, CFO/COO/CEO decisions, final acceptance, allocation records and a tamper-evident audit trail.
