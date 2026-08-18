# Wimpie backend handoff: KaSiShares investor application and approval workflow

## 1. Objective

Implement the production backend required to support the Solidus Holdings Class B Share Investor Application Pack without weakening the existing presale security boundaries.

This handoff covers:

- applicant drafts across the six frontend phases;
- the missing Section 10 applicant fields;
- KYC/FICA evidence requirements;
- explicit suitability, beneficial-owner, FATCA/CRS, AML and investor declarations;
- compliance review and requests for additional information;
- separated CFO, COO and CEO/EXCO decisions;
- final acceptance;
- creation of a payment reservation only after the required approvals;
- immutable snapshots, audit evidence and controlled incorporation into the share ledger.

No backend implementation is included in the frontend work. All wording that creates legal, tax, investment, signature, privacy or retention obligations must be supplied or approved by legal/compliance before release.

## 1A. Priority missing-field register for Wimpie

This register is the implementation checklist derived from the supplied Section 10 application compared with the current six-step web form.

Legend:

- **P0 missing**: absent from the web payload and required in the backend schema before the frontend can collect it.
- **P0 displaced**: present elsewhere in the current form, but not grouped with the Company/Trust selection where the applicant needs it.
- **P1 missing**: required for a complete Section 10 workflow but may follow the initial identity implementation.
- **Internal only**: belongs in staff/Admin workflows and must not be added to the public applicant payload.

### Immediate P0: Step 1 Company and Trust identity block

The current Step 1 contains `applicantType`, but selecting `company` or `trust` does not expose the Section 10 Company/Trust details. Wimpie must add the conditional backend contract first; the frontend can then render it under the applicant-type selector.

| Section 10 field | Current web status | Required backend field/action |
| --- | --- | --- |
| Entity/Trust Name | **P0 missing** as a dedicated conditional field | `entity.name`; required for Company and Trust |
| Registration Number / Trust authority number | **P0 displaced** to Step 3 as `entityRegistrationNumber` | Move to/serve in the Step 1 identity contract; validate conditionally by applicant type |
| VAT Number | **P0 displaced** to Step 3 | Include in Step 1 entity contract; optional/conditional according to approved policy |
| Income Tax Number | **P0 ambiguous** because Step 1 has only generic `taxNumber` | Define `entity.incomeTaxNumber`; do not silently overload an individual tax-number field |
| Registered Address | **P0 missing** | `entity.registeredAddress` as a structured address |
| Authorised Representative Name | **P0 displaced** to Step 3 | Include in Step 1 representative group |
| Authorised Representative Position | **P0 displaced** to Step 3 | Include in Step 1 representative group |
| Authorised Representative ID Number | **P0 missing** | `entity.authorisedRepresentative.identityNumber` |
| Authorised Representative Mobile Number | **P0 missing** | `entity.authorisedRepresentative.mobileNumber` |
| Authorised Representative Email Address | **P0 missing** | `entity.authorisedRepresentative.emailAddress` |

Backend conditional rule:

- `individual`: reject or ignore the Company/Trust entity object unless an approved representative use case exists.
- `company`: require company name, registration number, registered address and authorised representative identity/contact fields. VAT and income-tax rules come from the approved evidence matrix.
- `trust`: require trust name, trust/authority number, registered/address-for-service details and authorised trustee/representative identity/contact fields. Do not assume CIPC validation applies to trusts.

The saved application version must preserve the selected applicant type and the exact conditional schema version used when the fields were completed.

### Step 1 missing individual/contact fields

| Section 10 field | Current web status | Required backend field/action |
| --- | --- | --- |
| Surname | **P0 missing** as a separate field | `individual.surname`; do not rely only on `buyerName` |
| ID / Passport Number | **P0 missing** from the application payload | Store/reference under the approved KYC authority boundary; return verified/prefilled status without exposing raw evidence unnecessarily |
| Physical Address | **P0 missing** | Structured `physicalAddress` |
| Physical-address Postal Code | **P0 missing** | `physicalAddress.postalCode` |
| Postal-address Postal Code | **P0 missing** | `postalAddress.postalCode` |

Already present in Step 1 and not missing: full legal name, email, primary phone, applicant type, date of birth, nationality, occupation, employer, alternative phone, tax number and a general postal-address field.

### Step 2 missing share-application fields

| Section 10 field | Current web status | Required backend field/action |
| --- | --- | --- |
| Funding Phase 1-10 | **P1 missing** | `fundingPhase`, only if business/legal confirms that Section 10 phases map to the campaign model |
| Price per Share | Displayed outside/alongside the form; not applicant-controlled | Server-authoritative quote response; never trust browser input |
| Total Investment Amount | **P1 missing** as an explicit quoted total | Server-calculated USD/USDT totals and quote reference |
| ZAR Equivalent | **P1 missing** | Optional server-generated indicative value with rate source/timestamp, only if finance approves |
| Amount Being Invested | **P1 missing/duplicate concept** | Normalize to server-authoritative quoted total; do not create a second conflicting amount field |

### Step 3 missing beneficial-owner declaration controls

The current Step 3 has a beneficial-owner name and relationship, but it does not ask the applicant to declare whether they are the beneficial owner or acting for somebody else.

Missing backend fields:

- **P0 missing** `beneficialOwnerStatus: self | acting_for_other`;
- **P0 missing** conditional represented-person/owner identity when acting for another;
- **P1 missing** structured multiple-beneficial-owner collection for entities if required by the approved ownership threshold;
- **P1 missing** ownership percentage/control type if required by compliance.

Country of tax residence, TIN, additional tax jurisdictions, entity registration number, VAT number, representative name/position and beneficial-owner name/relationship are already present in Step 3. Some entity fields should be moved into the conditional Step 1 contract as noted above.

### Step 4 fields

The main source-of-funds and banking fields are present: source, source details, funds ownership, account holder, bank, branch, account number, account type and SWIFT/BIC.

Remaining conditional gap:

- **P1 missing** explicit `fundsOwnershipDetails` when `fundsOwnership = other`.

All bank, tax and identity values require encrypted storage, redacted Admin summaries and audited access.

### Step 5 missing KYC/FICA evidence fields

The current Step 5 displays an informational note only. It does not return or capture a document requirement checklist, upload/link status or review status.

**P0 missing backend requirement matrix and evidence links:**

Individual:

- Certified ID copy
- Proof of address under the approved age limit
- Proof of bank account
- Tax-number confirmation
- Source-of-funds declaration
- Proof of payment only at the correct post-payment stage

Company:

- CIPC registration documents
- Directors register
- Beneficial-ownership information
- Tax clearance if applicable
- Proof of business address
- Company bank confirmation
- Resolution authorising the investment
- Proof of payment only at the correct post-payment stage

Trust:

- Trust deed
- Letter of Authority
- Trustee IDs
- Beneficial-ownership information
- Proof of address
- Proof of payment only at the correct post-payment stage

For every requirement, the API must return: requirement code, label/version, applicability, status, linked KYC document ID, upload/scan/review state, rejection reason and whether an authorised waiver exists.

### Step 5 missing individual suitability and AML acknowledgements

The current frontend compresses the Section 10 confirmations into three aggregate checkboxes. The backend must support separate, versioned declaration codes so the exact accepted wording is auditable.

**P1 missing as individual declaration records:**

- Class B shares are non-voting.
- Dividends are discretionary.
- Capital growth is not guaranteed.
- The investment is long-term.
- Shares may be difficult to sell.
- Solidus does not guarantee liquidity.
- Solidus does not guarantee share buy-backs.
- Tokenisation may never occur.
- The investor may lose part or all of the investment.
- Investment Memorandum read.
- Subscription Agreement read.
- Risk Disclosure Statement read.
- Funds are not proceeds of crime.
- Funds do not originate from money laundering.
- Funds are not linked to terrorist financing.
- Information is true and correct.
- Applicant agrees to provide additional information if requested.

The backend may group these visually later, but it must preserve each declaration code, wording version, wording hash and acceptance timestamp.

### Step 6 missing signature and final declaration fields

| Section 10 field | Current web status | Required backend field/action |
| --- | --- | --- |
| Explicit application for the stated Class B shares | **P1 missing** as an individual declaration | Versioned declaration code |
| Investment Memorandum read and understood | **P1 missing** | Versioned document acknowledgement |
| Subscription Agreement read and understood | **P1 missing** | Versioned document acknowledgement |
| Dividend Policy read and understood | **P1 missing** | Versioned document acknowledgement |
| Risk Disclosure Statement read and understood | **P1 missing** | Versioned document acknowledgement |
| Investment made voluntarily | **P1 missing** | Versioned declaration code |
| Independent advice obtained where required | **P1 missing** | Versioned declaration code |
| Agreement to Company MOI/governing documents | **P1 missing** | Versioned declaration code |
| Investor/signatory Name | **P0 missing** in the signature block | Signatory field bound to immutable submitted version |
| Signature | **P0 missing** | Approved electronic-signature method/provider reference |
| Date | **P0 missing** | Server timestamp plus approved applicant-visible date |
| Place | **P0 missing** | Signed-place field if legal retains it |

The current Step 6 reservation acknowledgement is not a substitute for the Section 10 investor declaration or a legally approved electronic signature.

### Internal fields: backend/Admin only

These Section 12 fields are missing from the public form by design. Wimpie must implement them in protected Admin/compliance services, not return them as applicant-editable fields:

- application number;
- date received;
- compliance approved/rejected/additional-information-required outcome;
- compliance comments;
- CFO decision/signature/date;
- COO decision/signature/date;
- CEO decision/signature/date;
- final investor accepted/declined status;
- share register updated;
- share allocation confirmed;
- welcome pack issued;
- investor number;
- shareholder number;
- shares allocated;
- allocation date.

### Backend delivery order for the field gaps

1. Implement P0 Company/Trust and individual Step 1 identity schema.
2. Implement P0 beneficial-owner status and conditional owner model.
3. Implement the policy-driven KYC/FICA requirement/link API.
4. Implement the immutable signature/declaration evidence model.
5. Add P1 quote/funding-phase and separated declaration fields after business/legal confirms the wording and campaign mapping.
6. Implement Section 12 only inside role-protected Admin workflows.

## 2. Non-negotiable architecture boundary

Do not extend `presale_orders` into a combined application, compliance case and approval record.

Use three distinct lifecycles:

1. **Investor application**: applicant facts, declarations, drafts, evidence references, compliance review and EXCO decisions.
2. **Presale order/payment**: server quote, reserved quantity, payment obligation, USDT verification, expiry and settlement.
3. **Share incorporation**: idempotent transfer of an approved, settled order into the separate live share ledger.

Required dependency direction:

`approved application -> presale order -> verified settlement -> incorporation batch -> share ledger`

Never allow:

- payment evidence to approve an application;
- a submitted application to issue a certificate;
- an EXCO decision to fabricate payment settlement;
- a browser-supplied total, price, allocation, approval status or KYC status to become authoritative;
- a launch, invitation click or form draft to consume shares;
- raw identity, tax, bank or KYC document data in application logs, analytics, URLs or audit summaries.

## 3. Current backend foundations to preserve

The repository already contains useful production boundaries:

- isolated Encore `presaleDb` and separate `sharesDb`;
- authenticated presale order creation;
- KYC authority checks before reservations;
- server-authoritative USD/USDT quote and payment configuration;
- payment obligations and intents;
- signed payment events and confirmation verification;
- idempotent incorporation batches;
- encrypted `investor_application` order snapshots;
- private KYC object storage with file-size, content-type, signature and checksum validation;
- audit logging for KYC evidence.

Extend these foundations. Do not replace them with a parallel unauthenticated API, frontend-only state or a second document bucket.

## 4. Required lifecycle

### 4.1 Application state machine

Recommended states:

- `draft`
- `submitted`
- `compliance_review`
- `information_required`
- `resubmitted`
- `compliance_cleared`
- `compliance_rejected`
- `exco_review`
- `exco_approved`
- `exco_rejected`
- `accepted`
- `withdrawn`
- `expired`
- `superseded`

Allowed transitions must be server-enforced. Example:

- `draft -> submitted`
- `submitted -> compliance_review`
- `compliance_review -> information_required | compliance_cleared | compliance_rejected`
- `information_required -> resubmitted`
- `resubmitted -> compliance_review`
- `compliance_cleared -> exco_review`
- `exco_review -> exco_approved | exco_rejected`
- `exco_approved -> accepted`
- `accepted -> presale order creation`

`withdrawn`, `expired` and `superseded` are terminal unless legal/compliance explicitly approves a reopen path.

### 4.2 Approval policy

Store decisions separately. Do not encode CFO, COO and CEO decisions as three nullable columns on the application.

Each decision requires:

- application ID and immutable submitted-version ID;
- role/capacity (`compliance`, `cfo`, `coo`, `ceo`, or approved replacement);
- authenticated reviewer user ID;
- decision (`approved`, `rejected`, `information_required`, `abstained` if approved);
- reason code;
- controlled free-text comment;
- decision timestamp;
- policy/version identifier;
- before/after audit event;
- optional second-factor or step-up-auth evidence for final acceptance.

The server must calculate whether EXCO approval is complete from a versioned policy. The client must never calculate quorum.

### 4.3 Order/payment gate

A presale order may be created only when all are true:

- application status is `accepted`;
- the accepted application version is immutable;
- the authenticated profile owns the application;
- KYC authority returns an approved/verified result required for that profile;
- campaign is active and not paused/closed;
- invitation is valid, unexpired and belongs to the same profile/email policy;
- requested quantity is within invitation and campaign availability;
- current server quote is accepted;
- declarations and legal-document versions still match active policy;
- no sanctions, fraud, duplicate identity or manual-hold flag blocks the application.

The resulting order stores `application_id` and `application_version_id`. It also stores an encrypted immutable application snapshot for legal evidence, but the application tables remain the system of record for the review history.

## 5. Data model

Names are recommendations; align with Encore/PostgreSQL conventions.

### 5.1 `presale_applications`

Searchable/minimal fields only:

- `id UUID PK`
- `application_number TEXT UNIQUE`
- `external_profile_id TEXT NOT NULL`
- `campaign_id UUID NOT NULL`
- `invitation_id UUID NULL`
- `applicant_type TEXT CHECK (individual, company, trust)`
- `status TEXT NOT NULL`
- `current_version INTEGER NOT NULL`
- `phase_completed SMALLINT NOT NULL DEFAULT 0`
- `completion_percent SMALLINT NOT NULL DEFAULT 0`
- `submitted_at`, `accepted_at`, `rejected_at`, `withdrawn_at`, `expires_at`
- `created_at`, `updated_at`
- `row_version BIGINT NOT NULL` for optimistic concurrency

Do not place names, identity numbers, bank details or tax identifiers in searchable columns unless a documented operational requirement and approved protection model exists.

### 5.2 `presale_application_versions`

- `id UUID PK`
- `application_id UUID NOT NULL`
- `version INTEGER NOT NULL`
- `schema_version TEXT NOT NULL`
- `status TEXT NOT NULL` (`draft`, `submitted`, `locked`, `superseded`)
- `public_summary JSONB NOT NULL` containing only non-sensitive operational summary
- `payload_ciphertext BYTEA NOT NULL`
- `payload_nonce BYTEA NOT NULL`
- `payload_auth_tag BYTEA NOT NULL`
- `encryption_key_version TEXT NOT NULL`
- `payload_sha256 TEXT NOT NULL`
- `created_by_profile_id TEXT NULL`
- `created_by_user_id TEXT NULL`
- `created_at`, `locked_at`
- unique `(application_id, version)`

Use envelope encryption or AES-256-GCM with managed key rotation. Never derive production encryption keys from weak strings. Decryption must be limited to narrowly scoped applicant/reviewer services.

### 5.3 `presale_application_declarations`

One row per declaration acceptance:

- application/version IDs;
- declaration code;
- document or wording version;
- accepted boolean;
- accepted timestamp;
- actor profile ID;
- server-captured evidence metadata allowed by approved privacy wording;
- content hash of the exact displayed wording.

Do not store only one `termsAccepted` boolean. The Word pack requires independently auditable declarations.

### 5.4 `presale_application_document_links`

Reference existing private KYC documents; do not duplicate raw files:

- application/version IDs;
- KYC case ID;
- KYC document ID;
- requirement code;
- applicant type;
- status (`required`, `uploaded`, `scanning`, `accepted`, `rejected`, `expired`, `waived`);
- reviewer ID and review timestamp;
- rejection/waiver reason code;
- created/updated timestamps.

The `waived` state requires an authorised reviewer, reason and audit event.

### 5.5 `presale_application_reviews`

- application/version IDs;
- review type (`compliance`, `kyc`, `fica`, `suitability`, `tax`, `fraud`, `manual`);
- status;
- assigned reviewer;
- started/completed timestamps;
- outcome/reason code;
- protected notes or encrypted notes reference.

### 5.6 `presale_approval_decisions`

Use the role-separated decision model described in section 4.2. Unique constraint should prevent two active decisions for the same application version and required capacity while retaining superseded history.

### 5.7 `presale_information_requests`

- application/version IDs;
- request ID and status;
- requester/reviewer ID;
- applicant-safe message;
- requested field/document codes;
- due date;
- sent/responded/closed timestamps;
- response-version ID.

### 5.8 `presale_application_events`

Append-only business event stream or outbox:

- event ID;
- application ID/version ID;
- event type;
- actor type and actor ID;
- correlation/request ID;
- safe metadata JSON;
- occurred/recorded timestamps;
- delivery status if used as an outbox.

Sensitive values must not be copied into event metadata.

### 5.9 Existing table changes

Add to `presale_orders`:

- `application_id UUID NOT NULL` for new production orders;
- `application_version_id UUID NOT NULL`;
- unique guard preventing more than one active order per accepted application unless approved policy supports retries;
- foreign-key or integrity mechanism appropriate to the Encore service boundary.

Legacy rows require a documented `legacy` application reference or nullable compatibility window. Do not fabricate approvals for historical orders.

## 6. Applicant payload schema

### 6.1 Phase 1: applicant identity and contact

Required/conditional fields:

- `applicantType`: `individual | company | trust`
- `legalName`
- `surname` for individuals
- `identityType`: `national_id | passport | registration | authority_number`
- `identityNumber`
- `dateOfBirth` for individuals
- `nationality`
- `taxNumber`
- `occupation`
- `employer`
- `mobileNumber`
- `alternativeNumber`
- `emailAddress`
- `physicalAddress` structured as lines/city/region/postalCode/country
- `postalAddress` with `sameAsPhysical` and structured address fields

Entity/trust conditional group:

- `entityName`
- `registrationNumber`
- `vatNumber`
- `incomeTaxNumber`
- `registeredAddress`
- `authorisedRepresentativeName`
- `authorisedRepresentativePosition`
- `authorisedRepresentativeIdentityNumber`
- `authorisedRepresentativeMobile`
- `authorisedRepresentativeEmail`

Do not ask the frontend to determine whether an identity number is valid. Server-side validation and provider KYC remain authoritative.

### 6.2 Phase 2: share application

- `fundingPhase`: integer 1-10 only if the approved campaign model retains this concept;
- `quantity`: positive integer within server limits;
- `zarEquivalentAcknowledged` or optional applicant-supplied reference only if legal/finance approves it.

Return, but never accept as authoritative input:

- unit price USD;
- unit price USDT;
- USD total;
- USDT total;
- optional ZAR indicative value and rate timestamp;
- quote reference and expiry;
- available allocation and BOGO/bonus result.

Reject stale quote references. All money uses fixed-precision decimal types, never binary floating point.

### 6.3 Phase 3: tax and beneficial ownership

- `countryOfTaxResidence`
- `tin`
- `additionalTaxJurisdictions[]` as structured country/TIN entries
- `beneficialOwnerStatus`: `self | acting_for_other`
- `beneficialOwnerName` when acting for another
- `beneficialOwnerRelationship`
- entity beneficial-owner collection if compliance requires multiple owners

The current single beneficial-owner name is insufficient for multi-owner entities. Legal/compliance must approve the ownership threshold and evidence matrix.

### 6.4 Phase 4: source of funds and banking

- `sourceOfFunds`
- `sourceOfFundsDetails`
- `fundsOwnership`
- `fundsOwnershipDetails` when `other`
- `amountBeingInvested` as server-derived/validated value
- `bankAccountHolder`
- `bankName`
- `bankBranch`
- `bankAccountNumber`
- `bankAccountType`
- `bankSwiftBic`

Bank and tax data must be encrypted in the version payload and redacted in admin lists. Access requires an explicit permission and audit event.

### 6.5 Phase 5: evidence and declarations

Document requirements must be policy-driven by applicant type and jurisdiction, not hard-coded in the browser.

Initial Section 10 requirement codes:

Individual:

- `individual_certified_identity`
- `individual_proof_of_address`
- `individual_bank_account_proof`
- `individual_tax_number_confirmation`
- `payment_proof` only at the correct post-payment stage
- `source_of_funds_declaration`

Company:

- `company_cipc_registration`
- `company_directors_register`
- `company_beneficial_ownership`
- `company_tax_clearance`
- `company_business_address_proof`
- `company_bank_confirmation`
- `company_investment_resolution`
- `payment_proof` only after payment

Trust:

- `trust_deed`
- `trust_letter_of_authority`
- `trust_trustee_identities`
- `trust_beneficial_ownership`
- `trust_proof_of_address`
- `payment_proof` only after payment

Suitability declarations require separate codes and exact approved wording versions, including non-voting status, discretionary dividends, capital risk, illiquidity, no guaranteed liquidity/buy-back, tokenisation risk, possible loss and acknowledgement of required documents.

AML declarations require separate codes for proceeds of crime, money laundering, terrorist financing, truth/accuracy and additional-information cooperation.

### 6.6 Phase 6: review, signature and submission

- applicant declaration codes and versions;
- investor/signatory name;
- signature method;
- signature provider reference if applicable;
- signed timestamp;
- signed place;
- signed application-version hash;
- approved consent/audit metadata.

Typing a name is not automatically a legally sufficient electronic signature. Legal must approve the signature method, evidence package and wording before production.

## 7. API contract

All endpoints require authenticated ownership or explicit staff RBAC. Use the standard API error envelope and correlation IDs.

### Applicant endpoints

`POST /presale/applications`

- creates or resumes an idempotent draft for profile/campaign/invitation;
- returns application ID, application number, row version, policy versions, required phases and required-document matrix.

`GET /presale/applications/:applicationId`

- returns an applicant-safe decrypted draft only to its owner;
- never returns internal notes or staff-only risk signals.

`PATCH /presale/applications/:applicationId/phases/:phase`

- validates and saves only the specified phase;
- requires `If-Match`/row version or explicit `rowVersion`;
- returns normalized values, field errors, new row version and completion state;
- cannot mutate a locked submitted version.

`POST /presale/applications/:applicationId/documents`

- returns or accepts the approved KYC evidence flow;
- preferably reuses `/kyc/international/cases/:caseId/documents` and creates a link record;
- never returns a permanent public object URL.

`GET /presale/applications/:applicationId/requirements`

- returns server-authoritative document/declaration requirements and statuses.

`POST /presale/applications/:applicationId/submit`

- executes complete server validation in one transaction;
- locks an immutable submitted version;
- calculates a payload hash;
- verifies declaration/document versions;
- moves state to `submitted`;
- emits an outbox event;
- does not create a payment order.

`POST /presale/applications/:applicationId/withdraw`

- allowed only under approved status rules;
- records reason and audit event;
- never deletes the legal record.

`POST /presale/applications/:applicationId/information-responses`

- creates a new draft version from the requested fields/documents;
- applicant resubmission locks a new immutable version.

### Staff/admin endpoints

`GET /admin/presale/applications`

- server pagination, filters and safe summary fields only;
- filters: campaign, status, assigned reviewer, submitted date, applicant type and safe reference identifiers;
- no bank account, full identity number or raw document data in list responses.

`GET /admin/presale/applications/:applicationId`

- permission-scoped detail;
- field-level redaction according to reviewer role;
- every sensitive-view action audited.

`POST /admin/presale/applications/:applicationId/assign`

- assign/reassign reviewer with reason and audit event.

`POST /admin/presale/applications/:applicationId/information-requests`

- sends an approved applicant-safe request and moves state to `information_required`.

`POST /admin/presale/applications/:applicationId/reviews`

- records compliance/KYC/FICA review result against one immutable version.

`POST /admin/presale/applications/:applicationId/decisions`

- records a role-separated decision;
- requires permission and current immutable version;
- rejects duplicate, stale or self-conflicting decisions.

`POST /admin/presale/applications/:applicationId/final-acceptance`

- requires server-computed quorum and compliance clearance;
- records final acceptance and accepted version;
- must be idempotent.

`POST /admin/presale/applications/:applicationId/create-order`

- creates the existing presale order/payment obligation only after acceptance;
- revalidates campaign, invitation, quantity, KYC and quote;
- links the accepted application/version;
- returns the existing order response.

## 8. Example phase-save response

```json
{
  "applicationId": "uuid",
  "applicationNumber": "KSI-2026-000001",
  "status": "draft",
  "rowVersion": 7,
  "savedPhase": 3,
  "phaseCompletion": {
    "1": "complete",
    "2": "complete",
    "3": "complete",
    "4": "incomplete",
    "5": "blocked",
    "6": "blocked"
  },
  "requirementsVersion": "section10-v1-approved",
  "declarationsVersion": "pending-legal-approval"
}
```

Validation errors should be stable and field-addressable:

```json
{
  "error": "validation_failed",
  "correlationId": "uuid",
  "fields": {
    "physicalAddress.postalCode": "required",
    "beneficialOwnerStatus": "required"
  }
}
```

## 9. Security and privacy requirements

- Server-side authentication on every applicant and staff endpoint.
- Applicant ownership check on every application/document read or mutation.
- RBAC permissions separated at least into applicant, compliance reviewer, KYC reviewer, finance reviewer, CFO decision, COO decision, CEO/final acceptance and system operator.
- No shared admin role that silently grants all sensitive-data access.
- Step-up authentication for final acceptance and other high-risk decisions.
- AES-256-GCM/envelope encryption for application payloads and protected notes.
- Managed key rotation with key-version metadata and tested recovery procedure.
- Private object storage only; short-lived signed reads or streamed authorised downloads.
- Existing MIME allowlist, magic-byte validation, 10 MB limit and SHA-256 duplicate detection retained.
- Add malware scanning/quarantine before a document becomes reviewable.
- Reject executable, macro-enabled and unsupported formats.
- Rate limits for draft creation, saves, uploads, submission and status polling.
- CSRF/session protections consistent with the rest of KaSiHub.
- No access tokens, invitation tokens, identity data or bank data in URLs.
- Redact protected fields from logs, traces, error trackers and analytics.
- Audit sensitive reads, downloads, exports, decisions, status changes and key administrative actions.
- Retention/deletion schedule supplied by legal/privacy; implement holds so deletion cannot destroy active legal evidence.
- Encrypted backups and a tested restore procedure.
- Separation between production and non-production data; no production PII in preview fixtures.

## 10. Audit event catalogue

Minimum events:

- `presale.application.created`
- `presale.application.phase_saved`
- `presale.application.version_locked`
- `presale.application.submitted`
- `presale.application.withdrawn`
- `presale.application.information_requested`
- `presale.application.resubmitted`
- `presale.application.sensitive_viewed`
- `presale.application.exported`
- `presale.document.linked`
- `presale.document.reviewed`
- `presale.review.assigned`
- `presale.review.completed`
- `presale.decision.recorded`
- `presale.application.accepted`
- `presale.application.rejected`
- `presale.order.created_from_application`
- `presale.application.retention_action`

Audit records must include actor, role, application/version, timestamp, correlation ID, outcome and safe before/after state. Do not include raw document content or unredacted sensitive values.

## 11. Notifications

Use an outbox/queue, not synchronous best-effort calls inside transactions.

Required notification events:

- draft saved/resume link if approved;
- submission received;
- additional information requested;
- additional information received;
- application accepted/rejected using approved wording;
- payment reservation ready;
- payment window expiring/expired;
- payment confirmed;
- incorporation completed if legally approved for applicant communication.

Templates, senders, channels and wording require business/legal approval. Do not expose internal reviewer comments.

## 12. Observability and operations

Metrics:

- applications created/submitted by campaign;
- phase-save validation failures;
- time in each review state;
- information-request rate;
- document upload/scan failures;
- approval/rejection counts by reason code;
- accepted-to-order conversion;
- order/payment failure rates;
- queue age and notification failure rate;
- sensitive-access and export volume.

Alerts:

- sustained submission failure;
- KYC/document storage outage;
- malware scanner unavailable;
- approval events without required roles;
- accepted applications failing order creation;
- order created without accepted application;
- incorporation mismatch;
- encryption/decryption or key-version failures;
- audit/outbox write failures.

Operational controls:

- campaign pause and kill switch;
- application submission pause independent of page availability;
- payment creation pause independent of review;
- document upload quarantine mode;
- role-revocation propagation;
- reconciliation report for accepted applications, orders, settlements and incorporations.

## 13. Migration and rollout

1. Add application tables and permissions without changing current order behavior.
2. Add encrypted draft/version services and applicant APIs behind a feature flag.
3. Integrate existing KYC evidence by reference.
4. Add staff review, information-request and role-separated decision APIs.
5. Add accepted-application gate to order creation in shadow/audit mode.
6. Backfill legacy orders with `legacy` linkage metadata; do not fabricate application approvals.
7. Update BFF/frontend to save phases and submit applications.
8. Enable hard order gate for a pilot campaign.
9. Reconcile application/order/payment/incorporation data.
10. Expand only after security, compliance and recovery sign-off.

Every migration requires an `up` migration consistent with the existing Encore migration history. Do not rewrite historical migrations.

## 14. Test plan

### Unit and schema tests

- applicant-type conditional validation;
- structured address and postal-code rules;
- funding phase/quantity limits;
- fixed-precision quote calculations;
- declaration version/hash validation;
- state-transition matrix;
- EXCO quorum policy;
- field-level redaction;
- encryption/decryption and key versions;
- requirement-matrix selection.

### Integration tests

- idempotent draft creation;
- optimistic concurrency conflict on stale save;
- immutable submitted version;
- information request creates a new version without mutating submitted evidence;
- KYC document ownership and application linking;
- disallowed file, forged MIME, oversize and duplicate upload handling;
- malware quarantine path;
- staff RBAC and decision separation;
- applicant cannot read internal notes;
- accepted application can create one valid order;
- non-accepted application cannot create an order;
- stale quote/campaign pause/KYC regression blocks order creation;
- payment settlement cannot change application approval;
- incorporation remains idempotent.

### Security tests

- horizontal applicant-ID access attempts;
- privilege escalation between reviewer roles;
- replayed submissions and decisions;
- invitation/access-token leakage checks;
- log/trace redaction;
- object-key guessing and expired signed URL;
- malicious file corpus;
- CSRF/session fixation/rate-limit behavior;
- backup restore and key recovery.

### End-to-end acceptance paths

- individual accepted path;
- company with representative and ownership evidence;
- trust with trustees and Letter of Authority;
- additional-information loop;
- compliance rejection;
- EXCO rejection;
- accepted application with expired invitation;
- accepted application with paused campaign;
- successful payment and incorporation;
- payment expiry without share allocation.

## 15. Definition of done

Backend implementation is not complete until:

- all required fields and conditional rules are represented in a versioned schema;
- drafts save per phase without creating reservations;
- submitted versions are immutable and cryptographically hashed;
- KYC files remain private and are linked, scanned and reviewable through RBAC;
- declarations are individually versioned and auditable;
- compliance and EXCO decisions are role-separated;
- final acceptance is server-computed and idempotent;
- no order can be created without an accepted application and current eligibility checks;
- no share can be incorporated without verified settlement;
- sensitive fields are encrypted, redacted and audited;
- migrations, automated tests, dashboards, alerts, backup restore and rollback are proven;
- legal/compliance approves wording, evidence matrix, signature method, retention and decision policy;
- frontend receives stable API contracts and a non-production test fixture.

## 16. Decisions required before implementation

Wimpie must obtain explicit owners/answers for:

- approved final Section 10 field and declaration wording;
- whether funding phases 1-10 remain an application field or map to campaign phases;
- whether payment is allowed only after compliance and full EXCO approval;
- required decision roles and quorum;
- who may request information, waive evidence or reverse a decision;
- KYC/FICA requirement matrix by applicant type and jurisdiction;
- beneficial-ownership thresholds and multi-owner schema;
- FATCA/CRS data and reporting obligations;
- accepted electronic-signature method and provider;
- privacy notice, consent metadata and retention schedule;
- approved legal documents and versioning source of truth;
- notification wording and channels;
- data-export permissions and format;
- legacy-order treatment;
- disaster-recovery objectives and operational owners.

Until those decisions are approved, implement schema/versioning and feature flags, but do not invent legal wording or enable production application submission.

## 17. Frontend integration dependency

After Wimpie publishes an approved contract, the frontend can be updated to:

- save each phase as a draft;
- render server-provided conditional fields and evidence requirements;
- upload/link documents through the approved KYC flow;
- display applicant-safe validation and review status;
- handle additional-information requests;
- lock the submitted version;
- show payment only after acceptance;
- keep `devPreview=1` read-only and disconnected from all backend requests.

Provide OpenAPI/Encore contract types, test credentials/fixtures, error catalogue, feature-flag name and rollout environment before frontend integration begins.
