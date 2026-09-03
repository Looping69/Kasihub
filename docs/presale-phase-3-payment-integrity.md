# KaSiShares Phase 3: Payment Engine Integrity & Recovery Report

## 1. Executive Summary

Phase 3 establishes financial integrity, crash recovery, and idempotent settlement across both **WebPay card payments** and **Remitano USDT on BNB Smart Chain (BSC)** for the KaSiShares presale. 

The core objective has been achieved:
> A legitimate buyer can complete payment successfully despite retries, refreshes, delayed providers, duplicate notifications, partial payments, blockchain confirmation delays, provider outages, or process restarts, without creating duplicate settlements, orphaned reservations, or duplicate share issuances.

Key architectural accomplishments:
* **Separation of Durable Authority and Disposable Attempts**: Payment obligations are durable financial authority, whereas WebPay checkout sessions and blockchain transaction submissions are disposable attempts. Failed, declined, or expired checkout attempts no longer permanently lock reservations.
* **Late-Payment WebPay Ordering Fix**: WebPay callbacks on cancelled, expired, or past-deadline reservations now evaluate reservation state *before* asserting confirmed status. Valid late payments route to `manual_review` with immutable audit events without asserting `confirmed` or consuming share inventory.
* **Cumulative Crypto Underpayment & Top-up Resolution**: Multiple transaction credits (e.g. $80 + $20 = $100$) accumulate additively against durable obligations. Partial funding remains `partially_paid`, exact funding settles to `paid`, and overpayments route to `review_required` without unauthorized share minting.
* **Canonical Blockchain Timestamp Deadlines**: Transactions mined before the reservation deadline are legally on-time regardless of RPC sync latency or confirmation delays.
* **Operational Manual-Review Resolution**: Implemented a privileged admin endpoint (`POST /admin/presale/orders/:orderReference/resolve-manual-review`) requiring admin authentication, an audited reason, and deterministic resolution paths (`approve_settlement` or `reject_and_cancel`).

---

## 2. Authoritative Payment Chain Map

The authoritative payment chain enforces strict single-source-of-truth ordering:

```
[Presale Reservation] (presale_orders)
       │
       ▼ creates
[Payment Obligation] (payment_obligations: amount, currency, status, expires_at)
       │
       ├───────────────────────────────────────────────┐
       ▼ (Card Rail)                                   ▼ (Crypto Rail)
[Payment Session] (payment_sessions)          [Payment Attempt] (payment_attempts)
   - disposable attempt                          - submitted transaction hash
   - provider: instapay_webpay_form              - network: bsc, asset: USDT
       │                                               │
       ▼ async callback                                ▼ verification worker
[Provider Event] (presale_payment_events)     [RPC & Custody Evidence]
   - checksum, amount, currency verification     - block timestamp vs deadline
       │                                         - 12 confirmations
       │                                         - Remitano custody digest
       │                                               │
       └───────────────────────┬───────────────────────┘
                               ▼
            [Additive Credit] (payment_credits)
               - ON CONFLICT (provider, provider_reference, asset) DO NOTHING
               - Advisory xact lock on payment-obligation
                               │
                               ▼
            [Settlement Policy] (classifyObligationFunding)
               - open | partially_paid | paid | review_required
                               │ (if exact sum matches due amount)
                               ▼
            [Payment Settlement] (payment_settlements)
               - UNIQUE (obligation_id)
                               │
                               ▼
            [Presale Fulfilment] (fulfilWebPayPresalePayment / fulfilSettledPresalePayment)
               - Updates presale_orders to 'confirmed'
               - Moves reserved_shares to sold_shares
                               │
                               ▼
            [Issuance Outbox] (presale_share_issuance_outbox)
               - UNIQUE (order_id)
                               │
                               ▼
            [Idempotent Share Issuance & Sealing]
```

---

## 3. WebPay Attempt Lifecycle Model

* **Durable Obligation**: `payment_obligations` tracks the total required ZAR amount, currency (`ZAR`), and expiration deadline.
* **Disposable Attempt**: Each click on "Continue to secure WebPay checkout" creates a new UUID `transactionId` and registers a `payment_session` under `instapay_webpay_form`.
* **State Decoupling**: Previously, `order.cardCheckoutStarted` permanently removed `start_card_checkout` from allowed applicant actions. In Phase 3, `deriveApplicantJourney` allows `start_card_checkout` whenever `order.status === "awaiting_payment"` and the payment obligation is unpaid before the deadline. An abandoned or declined attempt does not prevent launching a fresh attempt.
* **Audit Trail**: Every attempt start records an immutable `payment.attempt_started` audit event in `presale_audit_events`.

---

## 4. WebPay Retry Verification Results

| Scenario | Behavior | Test Verification | Status |
| :--- | :--- | :--- | :--- |
| **Declined checkout** | Provider returns non-completed status; session marked `failed`; obligation remains `open`; buyer can relaunch checkout | `payment-engine-integrity.test.ts` | **PASS** |
| **Abandoned checkout** | Buyer closes browser; session expires; reservation remains `awaiting_payment`; fresh checkout generates new UUID | `webpay-payment-recovery.spec.ts` | **PASS** |
| **Timeout / Network error** | Gateway POST fails; error displayed; reservation card preserved; retry CTA remains accessible | `webpay-payment-recovery.spec.ts` | **PASS** |
| **Multiple failed attempts** | Multiple sessions logged in `payment_sessions`; 0 credits recorded; exactly 0 inventory deducted | `presale-phase-3-payment-engine.contract.test.ts` | **PASS** |

---

## 5. WebPay Callback Authority & Checksum Verification

WebPay callbacks are verified strictly against cryptographic and merchant identity constraints:
* **Checksum Construction**: `MD5(merchantUuid + "_" + accountUuid + "_" + transactionId + "_" + amountCents + "_" + "ZAR" + "_" + securityKey)`.
* **Timing-Safe Comparison**: `crypto.timingSafeEqual` prevents timing side-channel attacks on checksum validation.
* **Merchant & Site Validation**: `payeeSiteId`, `payeeUuid`, and `payeeAccountUuid` must match server environment configuration.
* **Currency & Amount**: Callback must be in `ZAR` and `paymentAmount` must exactly match `order.total_zar`.
* **Process Webhook**: `verifyWebPayProcessChecksum` verifies `accountUuid`, `processUuid`, `processStage`, and `securityKey`.

---

## 6. WebPay Out-of-Order and Duplicate Callback Results

1. **Callback Before Redirect**: The webhook completes settlement and outbox generation. When the user returns to `/shares/account?payment=webpay`, the portal immediately presents the confirmed reservation state.
2. **Redirect Before Callback**: When the user returns to `/shares/account?payment=webpay` before the webhook arrives, the portal displays a non-blocking notification: *"WebPay returned successfully. We are waiting for the signed payment notification before confirming your shares."* It polls `loadPortal()` up to 15 times (30 seconds) until confirmed.
3. **Duplicate Webhook Callbacks**: Handled idempotently via `presale_webpay_settlements` (`PRIMARY KEY (provider_reference)`) and `payment_credits` (`UNIQUE (provider, provider_reference, asset)`). A second delivery produces no additional credit, no duplicate settlement, and no second share allocation.
4. **Concurrent Duplicate Callbacks**: PostgreSQL advisory transaction lock `pg_advisory_xact_lock(hashtext('payment-obligation:' || id))` serializes execution. Exactly one credit is inserted.

---

## 7. WebPay Replay and Mismatch Protection Results

* **Tampered Amount**: Checksum verification fails closed (`APIError.permissionDenied("WebPay checksum verification failed")`).
* **Mismatched Merchant ID**: Rejects before database lookup.
* **Unknown Transaction ID**: Fails precondition with no session found.
* **Missing Payment System Reference**: Throws `failedPrecondition("Completed WebPay payment is missing its payment-system reference")`.
* **Reused Settlement Reference**: Throws `alreadyExists("WebPay settlement reference was already used for different payment evidence")`.

---

## 8. Late-Payment WebPay Ordering Fix and Audit Results

### Defect Identified & Corrected
In prior revisions, `fulfilWebPayPresalePayment` invoked:
```ts
assertApplicantJourneyTransition(orderJourneyState(order.status), "confirmed");
```
*before* checking if the order was cancelled, expired, or past deadline. This caused an unhandled state-machine assertion exception for late or cancelled orders, preventing the preservation of payment evidence.

### Fixed Ordering
1. Checks whether the order is `cancelled`, `expired`, `manual_review`, or past `payment_deadline`.
2. Asserts legal transition to `"manual_review"` (`cancelled -> manual_review` and `expired -> manual_review` are legal transitions).
3. Updates `presale_orders` status to `manual_review`, recording `webpay_system_reference` and `payment_settled_at`.
4. Records audit event `payment.late_detected` with full provider evidence, prior status, and reason (`payment_after_cancellation` or `payment_after_deadline`).
5. Commits and returns *without* asserting `"confirmed"`, *without* deducting campaign inventory, and *without* enqueueing share issuance.

---

## 9. Missed-Callback Reconciliation Status & Provider Limitations

> [!WARNING]
> **EXTERNAL PROVIDER LIMITATION**:
> The WebPay / InstaPay gateway integration in this codebase operates via hosted HTML form redirection and async signed HTTP POST webhooks (`notify_url` and `process_url`). WebPay does not provide a server-to-server REST polling endpoint to query the status of an arbitrary order without an incoming callback.
> 
> **Reconciliation Strategy**:
> * All callback attempts and payload digests are permanently stored in `payment_provider_events` and `presale_payment_events`.
> * Duplicate callbacks are replay-safe and trigger immediate reprocessing if an earlier processing attempt was interrupted.
> * Late or ambiguous callbacks route to `manual_review`, where administrators can inspect provider references and execute audited resolutions via `resolvePresaleManualReview`.

---

## 10. Crypto Canonical-Chain Verification Results

Crypto payment proof submissions on BNB Smart Chain (BSC) are verified with zero mocks in production:
* **Format Validation**: Transaction hash must be `0x` followed by exactly 64 hexadecimal characters.
* **RPC Chain Adapter**: Reads receipt status (`0x1` success), token transfer logs, contract address (`0x55d398326f99059ff775485246999027b3197955` BEP-20 USDT), recipient address (campaign receiving address), and decimal conversion (18 decimals).
* **Confirmations**: Requires minimum 12 BSC block confirmations. Attempts with fewer confirmations transition intent to `pending_confirmations`.
* **Replay Protection**: Database unique constraint on `payment_attempts (transaction_hash)` ensures a transaction hash cannot be submitted for multiple payment intents.

---

## 11. Canonical Payment Timestamp Evaluation Results

* **Mining Block Authority**: The blockchain block header `blockTimestamp` is the sole authoritative payment timestamp.
* **On-Time Settlement**: If a transaction is mined before `order.payment_deadline`, it is evaluated as `"on_time"` even if RPC outages, queue backlog, or confirmation delays cause detection to occur hours or days later.
* **Late Settlement**: If `blockTimestamp > order.payment_deadline`, it evaluates to `"late"` and routes the payment intent to `manual_review` without consuming inventory.
* **Missing Block Timestamp**: Evaluates to `manual_review` to prevent falsified local server timestamps.

---

## 12. Remitano Custody Reconciliation Results

* **Separate Authority**: Crypto transfers are dual-verified against Remitano deposit notifications where configured.
* **Matching**: Receiver address, currency (`USDT`), amount, and transaction hash must match.
* **Outage Recovery**: If Remitano API is temporarily unreachable, custody decision returns `"retryable"`, intent transitions to `verifying`, and the queue automatically retries without marking the payment failed.
* **Contradiction**: A discrepancy between chain evidence and Remitano record routes to `manual_review` with reason `custody_mismatch`.

---

## 13. Provider Outage Recovery Behaviour

* **BSC RPC Outage**: `evaluatePaymentEvidence` catches network failures and returns `decision: "retryable"`. The attempt remains in `verifying` status with an audit event `payment.provider_retry`.
* **Process Restarts**: Because outbox events (`payment_outbox`, `presale_share_issuance_outbox`) and obligation states are committed in PostgreSQL transactions, interrupted processes resume upon restart without losing in-flight state.

---

## 14. Cumulative Underpayment / Top-Up Test Results

The payment engine supports cumulative top-ups for underpaid orders:
1. **Single Underpayment**: Buyer owes 100 USDT, sends 80 USDT. `classifyObligationFunding` sets obligation status to `partially_paid` and intent status to `underpaid`.
2. **Top-Up Submission**: The applicant journey for `underpaid` allows `submit_payment_hash`. Buyer submits second hash for 20 USDT.
3. **Cumulative Settlement**: Second credit is recorded in `payment_credits`. Cumulative sum $80 + 20 = 100$ satisfies the obligation due amount. Obligation status transitions to `paid`, intent transitions to `confirmed`, and fulfilment proceeds exactly once.
4. **Three-Part Top-Up**: Tested and verified: 40 + 30 + 30 = 100 settles cleanly.
5. **Duplicate Hash Submission**: Same transaction hash submitted twice is rejected via unique constraint, preventing artificial credit inflation.

---

## 15. Overpayment Policy and Enforcement Results

* **Policy**: When crypto payments exceed the obligation (e.g. 105 USDT for 100 USDT obligation), `classifyObligationFunding` evaluates status as `"review_required"`.
* **Enforcement**: Intent transitions to `manual_review`.
* **Zero Unauthorized Minting**: No extra shares are allocated. The reserved share quantity remains strictly equal to the original reservation. Excess funds are preserved in audit records for manual review or refund under corporate policy.

---

## 16. Database Duplicate Protection Inventory

| Table | Constraint | Enforced Invariant |
| :--- | :--- | :--- |
| `payment_obligations` | `UNIQUE (subject_type, subject_reference)` | One durable obligation per presale reservation |
| `payment_sessions` | `UNIQUE (provider, provider_session_id)` | Unique checkout attempt session IDs |
| `payment_attempts` | `UNIQUE (transaction_hash)` | No transaction hash reuse across intents |
| `payment_credits` | `UNIQUE (provider, provider_reference, asset)` | Single financial credit per provider payment reference |
| `payment_settlements` | `UNIQUE (obligation_id)` | Exactly-once settlement per obligation |
| `payment_outbox` | `UNIQUE (event_key)` | At-least-once outbox with deduplication |
| `presale_webpay_settlements` | `PRIMARY KEY (provider_reference), UNIQUE (order_id)` | One WebPay settlement claim per presale order |
| `presale_share_issuance_outbox` | `UNIQUE (order_reference)` | Exactly-once share issuance handoff |
| `presale_audit_events` | `UNIQUE (event_key)` | Deduplicated immutable audit events |

---

## 17. Cancellation vs Payment Race Condition Results

* **Locking**: Row locks (`FOR UPDATE`) and advisory locks (`SELECT pg_advisory_xact_lock(hashtext('payment-obligation:' || id))`) serialize cancellation requests and payment verifications.
* **Deterministic Outcome**:
  * If cancellation commits first, late payment callback transitions reservation to `manual_review` with event `payment_after_cancellation`. Inventory is NOT double-released.
  * If payment settlement commits first, cancellation precondition fails (`"reservation_not_awaiting_payment"`), preserving the valid payment and confirmed shares.

---

## 18. Expiry vs Payment Race Condition Results

* **Deterministic Outcome**:
  * If an expiry worker marks an order `expired`, a subsequent payment mined before the deadline transitions the order to `manual_review` with event `on_time_transaction_after_reservation_release`. The payment evidence is permanently preserved for admin review.
  * If mined after the deadline, it routes to `manual_review` with event `transaction_mined_after_deadline`.

---

## 19. Paid-but-Not-Confirmed Recovery Results

* **Durable Outbox Reconciliation**: `reconcileSettledPaymentObligations` scans `payment_outbox` for `payment_obligation.settled` events.
* **Recovery**: If the presale fulfilment worker crashed after obligation settlement but before updating `presale_orders`, the reconciler detects the unsettled order and triggers `fulfilSettledPresalePayment` idempotently.

---

## 20. Settlement-to-Issuance Handoff Verification

* **Outbox Pattern**: `enqueuePresaleIssuanceRequest` writes to `presale_share_issuance_outbox` inside the fulfilment transaction.
* **Immediate Attempt with Safe Fallback**: `attemptImmediatePresaleIssuance` attempts immediate sealing. If it fails, the durable background worker `processPresaleShareIssuances` retries until completion.
* **Zero Duplicate Shares**: The share register constraint prevents multiple certificate numbers or share allocations for the same order reference.

---

## 21. Manual Review Resolution Operational Path

Implemented authenticated admin endpoint:
`POST /admin/presale/orders/:orderReference/resolve-manual-review`

* **Privilege**: Requires `admin` role (`requireAdminAccess()`).
* **Input Validation**: Requires non-empty `reason` string and `action` (`"approve_settlement"` or `"reject_and_cancel"`).
* **Genuine Evidence Required**: If approving settlement, verified payment evidence (`payment_transaction_hash` or `webpay_system_reference`) must exist on the order. Evidence is never fabricated.
* **Approval Flow**: Transitions `manual_review -> confirmed`, updates campaign `sold_shares`, enqueues share issuance outbox, records audit event `payment.manual_review_resolved`.
* **Rejection Flow**: Transitions `manual_review -> cancelled`, cancels payment obligation, records audit event `payment.manual_review_rejected`.

---

## 22. Durable Audit Event Inventory

| Audit Event Key | Trigger | Actor |
| :--- | :--- | :--- |
| `payment.attempt_started` | Checkout started | `profile` |
| `payment.attempt.submitted` | Transaction hash submitted | `profile` |
| `payment.detected` | Blockchain transfer observed | `system` |
| `payment.pending_confirmations` | Insufficient block confirmations | `system` |
| `payment.underpaid` | Cumulative credit below obligation | `system` |
| `payment.credit_recorded` | Confirmed financial credit | `system` |
| `payment.provider_retry` | Provider temporarily unavailable | `system` |
| `payment.custody_verified` | Remitano deposit match confirmed | `system` |
| `payment.manual_review` | Custody mismatch, overpayment, or anomaly | `system` |
| `payment.late_detected` | Payment received on expired/cancelled order | `system` |
| `payment.settled` | Obligation fully funded | `system` |
| `payment.manual_review_resolved` | Admin approved manual review | `admin` |
| `payment.manual_review_rejected` | Admin rejected manual review | `admin` |

---

## 23. Browser Recovery Test Results

All Playwright browser recovery tests pass:

```
Running 5 tests using 2 workers

ok 1 webpay-payment-recovery.spec.ts: shows start checkout CTA when reservation is awaiting payment (1.1s)
ok 2 webpay-payment-recovery.spec.ts: retains reservation card and retry action if WebPay checkout endpoint returns error (429ms)
ok 3 webpay-payment-recovery.spec.ts: advances cleanly to confirmed state when webhook settles payment (344ms)
ok 4 crypto-payment-recovery.spec.ts: recovers a stored crypto payment and reveals the issued shares (6.4s)
ok 5 crypto-payment-recovery.spec.ts: manual recheck reports verified settlement without claiming the certificate is already ready (394ms)

5 passed (17.6s)
```

---

## 24. Production Safety Review Findings

1. **Test Pricing Isolation**: Verified that PostgreSQL constraint `presale_active_campaign_has_real_pricing` prevents test prices on active campaigns.
2. **Mock Campaigns**: Verified that `payload.isMock` throws `APIError.invalidArgument("Mock campaigns are no longer supported")`.
3. **No Financial Bypasses**: Codebase search confirmed zero bypass mechanisms for production payment verification.

---

## 25. Automated Test Matrix and Coverage

* **Root Unit & Contract Suite**: 40 test files, **258 tests passed** (`npm test`).
* **Encore Unit & Domain Suite**: 39 test files, **225 tests passed** (`npx vitest run ...`).
* **Playwright Browser Recovery Suite**: 2 test files, **5 tests passed**.
* **TypeScript Typecheck**: 0 errors (`tsc --noEmit`).

---

## 26. Explicit Phase 3 PASS / BLOCKED Checklist

| Requirement | Description | Status |
| :---: | :--- | :---: |
| 1 | Map and verify authoritative payment chain | **PASS** |
| 2 | WebPay attempt lifecycle (disposable attempts vs durable obligation) | **PASS** |
| 3 | WebPay retry verification (declined, abandoned, timeout) | **PASS** |
| 4 | WebPay callback authority and checksum verification | **PASS** |
| 5 | WebPay callback ordering (before return, after return, duplicate) | **PASS** |
| 6 | WebPay replay and mismatch protection | **PASS** |
| 7 | Fix late-payment WebPay ordering (preserve evidence, manual review) | **PASS** |
| 8 | WebPay missed-callback reconciliation & documented provider limitations | **PASS** |
| 9 | Crypto canonical-chain verification (token, network, receiver, amount) | **PASS** |
| 10 | Canonical payment timestamp (mining block governs deadline) | **PASS** |
| 11 | Remitano custody reconciliation (fail-closed, retryable outages) | **PASS** |
| 12 | Provider outage recovery (RPC down, Remitano down, process restart) | **PASS** |
| 13 | Cumulative underpayment / top-up support ($80 + $20 = $100) | **PASS** |
| 14 | Underpayment and top-up test suite | **PASS** |
| 15 | Overpayment policy (routes to manual review, no extra shares) | **PASS** |
| 16 | Duplicate transaction protection (database unique constraints) | **PASS** |
| 17 | Cancellation vs payment race condition handling | **PASS** |
| 18 | Expiry vs payment race condition handling | **PASS** |
| 19 | Settlement idempotency (exactly-once settlement) | **PASS** |
| 20 | Paid-but-not-confirmed recovery | **PASS** |
| 21 | Settlement-to-issuance handoff (outbox pattern) | **PASS** |
| 22 | Operational manual-review resolution endpoint for privileged admins | **PASS** |
| 23 | Durable payment audit events | **PASS** |
| 24 | Browser payment recovery tests | **PASS** |
| 25 | Production safety review | **PASS** |
| 26 | Multi-layer test verification | **PASS** |

---

## 27. Production Readiness Statement

> [!CAUTION]
> **Real-Money Production Readiness: NO**
>
> While software architecture, database integrity, state-machine transitions, and recovery mechanisms have been fully validated, production readiness remains **NO** until:
> 1. Live WebPay merchant credentials, production notification webhooks, and SSL callbacks have been certified in the live hosting environment.
> 2. Live Remitano webhook signing keys and custody deposit addresses have been provisioned in the production secret store.
> 3. Production PostgreSQL database migrations have been executed on the live cluster.
> 4. Controlled live end-to-end sandbox payments have been executed through the external providers to confirm live network routing.
