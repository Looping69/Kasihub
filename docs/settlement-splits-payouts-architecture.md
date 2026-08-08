# Kasihub Settlement, Splits & Payouts Architecture

Author: Klaasvaakie ( |╲ )

## Purpose

This document defines the financial architecture that sits between a successfully settled Kasihub payment and an eventual external payout.

The key principle is simple:

> A payment settlement is not the same thing as a payout.

A settled customer transaction must first be translated into authoritative internal allocations. Those allocations become ledger-backed earnings, liabilities and pool balances. External payouts happen later, through a separate controlled workflow.

This design prevents product domains, payment providers and blockchain rails from becoming the authority for what a person or entity has earned.

## Why this layer is required

The international USDT payment architecture currently provides:

1. authoritative payment obligation;
2. payment intent;
3. blockchain/payment verification;
4. settlement;
5. downstream product fulfilment;
6. optional future outbound payout provider.

What was missing is the financial layer between settlement and outbound payout:

- transaction splits;
- commissions;
- pool contributions;
- referral/member earnings;
- platform revenue;
- shareholder/dividend liabilities;
- small-value earnings accumulation;
- payout thresholds and batching;
- outbound payout reservation and reconciliation.

Without this layer, product code would eventually hard-code percentages and send external payments directly from business events. That creates fragmented financial logic, expensive provider traffic, inconsistent rounding, duplicate payout risk and weak auditability.

## Canonical financial flow

```text
PAYMENT
   |
   v
SETTLEMENT
   |
   v
SPLIT / ALLOCATION ENGINE
   |
   v
INTERNAL LEDGER
   |
   v
PAYABLE BALANCES
   |
   v
PAYOUT AGGREGATION
   |
   v
OUTBOUND PAYOUT PROVIDER
   |
   v
RECONCILIATION
```

The stages are deliberately separate. Each stage has one responsibility and one authoritative record.

## Core invariants

1. **Payment verification does not calculate business rewards.**
   Blockchain/RPC/provider code proves that value arrived. It does not decide who earns what.

2. **Split calculation does not perform external payouts.**
   It creates internal allocation/ledger entries only.

3. **Every split must balance exactly.**
   The value assigned to outputs must equal the allocatable input amount in the smallest supported monetary unit.

4. **Every earning exists in Kasihub before any provider payout exists.**
   An external provider failure must never erase or duplicate the earning.

5. **Small earnings accumulate internally.**
   Kasihub must not create a provider transaction for every small commission, pool share or reward.

6. **Payout providers are adapters, not financial truth.**
   InstaPay, Remitano or another provider executes an approved payout instruction. Kasihub owns the payable balance and payout state.

7. **Policies are versioned.**
   Historical transactions must always be explainable using the exact split and payout policy that applied when the financial event occurred.

8. **All financial workflows are idempotent and auditable.**
   Retries may repeat processing but may not duplicate value.

## Relationship to existing Kasihub architecture

Kasihub already contains important foundations that should be reused rather than replaced:

- internal ledger and financial workflow infrastructure;
- idempotency keys and financial operation records;
- persisted distribution allocations;
- dividend distribution logic;
- pool distribution logic;
- marketplace commission calculation;
- settlement/payment architecture with durable events/outbox patterns.

The new design generalizes these capabilities behind a shared allocation and payout model.

## 1. Settlement boundary

A settlement records the fact that Kasihub has accepted a payment as final for the relevant business obligation.

Examples:

- local InstaPay transaction settled;
- international USDT payment settled;
- future trusted payment rail settled.

The settlement event should identify at minimum:

- settlement id;
- payment/obligation id;
- product/subject type;
- product/subject reference;
- payer profile;
- gross settled amount;
- currency;
- settlement rail;
- settlement timestamp;
- policy context/version where already known.

A settlement must not directly trigger external payouts.

## 2. Split / Allocation Engine

### Responsibility

The Split Engine converts a settled business amount into a deterministic set of financial allocations.

Example only:

```text
Gross settled amount      100.00

Merchant revenue           80.00
Platform revenue           10.00
Community pool              5.00
Referral reward             3.00
Other configured pool       2.00
                           ------
Total allocations         100.00
```

The percentages and recipients above are illustrative. Production values are business policy and must not be invented by engineering.

### Split policy

Each product or transaction type should reference a versioned policy definition.

A policy may define:

- policy id/version;
- subject/product type;
- effective date range;
- source amount basis;
- allocation rules;
- recipient resolution rules;
- rounding/remainder rule;
- eligibility rules;
- tax/fee treatment where applicable;
- disabled/suspended recipient fallback;
- minimum allocatable unit.

### Allocation outputs

An allocation should include:

- settlement id;
- policy id/version;
- allocation type;
- recipient type;
- recipient reference/profile;
- amount;
- currency;
- ledger account;
- status;
- source evidence/reference;
- created timestamp.

Allocation types may include:

- merchant revenue;
- platform revenue;
- referral reward;
- member reward;
- community pool contribution;
- shareholder/dividend liability;
- commission;
- reserve/fee account;
- other future configured categories.

### Exact arithmetic

Split calculation must use integer/atomic monetary units, not floating-point arithmetic.

Required rule:

```text
sum(all allocation units) == allocatable settlement units
```

Any indivisible remainder must follow an explicit deterministic remainder policy. It may not disappear.

## 3. Internal ledger

Every accepted allocation becomes an internal financial record before payout logic runs.

The ledger is the authoritative answer to questions such as:

- what did this member earn?
- why did they earn it?
- what portion has already been paid out?
- what is still payable?
- what transaction/policy created the value?

The ledger must support immutable/double-entry principles consistent with the existing finance architecture.

Where a business event changes financial ownership, the debit and credit sides must be identifiable and auditable.

## 4. Payable balances

### Principle

A payable balance represents value Kasihub owes to a beneficiary but has not yet paid externally.

This is different from an application wallet balance used for spending inside Kasihub.

Recommended conceptual balances:

- earned/pending;
- available for payout;
- reserved for payout;
- paid;
- held/manual review;
- reversed/adjusted where permitted by explicit correction workflow.

### Small payouts

Small allocations accumulate into the beneficiary's payable balance.

Example:

```text
Reward 1    0.32
Reward 2    1.10
Reward 3    0.48
Reward 4    4.60
           -----
Payable     6.50
```

Kasihub records four earnings but creates no external payout unless the payout policy says the balance is eligible.

This prevents transaction-fee waste, provider noise and reconciliation complexity.

## 5. Payout Aggregator

### Responsibility

The Payout Aggregator turns eligible payable balances into controlled payout instructions.

It must not recalculate earnings.

### Configurable payout policy

The policy should support:

- minimum payout threshold;
- maximum automatic payout threshold;
- payout frequency/window;
- automatic vs member-requested payout;
- provider/rail selection;
- fee ownership;
- economical minimum after provider/network fees;
- KYC/compliance eligibility;
- account/payout destination readiness;
- hold/freeze/manual-review status;
- per-day/per-period limits;
- batching rules;
- retry rules;
- currency/network restrictions.

### Eligibility example

A beneficiary with a payable balance of 6.50 and a minimum threshold of 100.00 remains unpaid externally, but the value remains fully recorded as theirs inside Kasihub.

Once the payable balance reaches the threshold, the aggregator may create a payout instruction according to the active policy.

## 6. Payout lifecycle

Recommended payout states:

- `queued`
- `reserved`
- `submitted`
- `provider_pending`
- `completed`
- `failed`
- `manual_review`
- `cancelled`

Optional future states may be added where provider-specific semantics require them, but provider statuses should be normalized into the Kasihub model.

### Reservation rule

Before a provider call, the payout amount must move from available payable balance to a reserved state in an atomic/idempotent internal transaction.

This prevents two workers from paying the same value twice.

### Completion rule

Only confirmed provider success/reconciliation moves the reserved amount to paid.

### Failure rule

A failed provider operation returns the amount to an appropriate retryable/available or held state according to policy. The original earnings remain intact.

## 7. Payout provider routing

### Local / eligible members

Primary payout route:

- InstaPay/local payout infrastructure, subject to the final InstaPay integration contract.

### International members

International payout route:

- USDT/outbound provider architecture;
- Remitano may be used behind a replaceable payout adapter if approved;
- other providers can be added without changing the internal payable model.

### Provider boundary

Provider adapters receive a payout instruction containing only what is required to execute the approved payout.

They do not determine:

- who earned the money;
- how much was earned;
- split percentages;
- payout eligibility policy;
- Kasihub's internal paid/available balance.

## 8. Reconciliation

Every outbound payout requires reconciliation between Kasihub and the external payout rail.

A payout record should include:

- payout id;
- beneficiary;
- amount/currency;
- payout destination reference;
- provider/rail;
- internal reservation reference;
- provider reference;
- provider status;
- normalized Kasihub status;
- fee information;
- submitted/completed timestamps;
- retry count;
- reconciliation state;
- failure/review reason;
- idempotency key/reference.

Reconciliation must detect:

- provider success not yet reflected internally;
- internal submission with no provider record;
- duplicate provider reference;
- amount mismatch;
- destination mismatch;
- fee mismatch where fees are part of the contract;
- stale provider-pending payouts.

## 9. Product-domain integration

Product domains should publish or invoke a shared settlement-allocation contract rather than implementing their own split logic.

Target pattern:

```text
Product obligation
      |
      v
Payment settled
      |
      v
Shared allocation engine
      |
      v
Ledger / payable balances
      |
      +--> product fulfilment event
      |
      +--> future payout aggregation
```

Examples:

### Marketplace

Current marketplace commission behaviour should evolve from calculation embedded in order code into a versioned split policy that allocates:

- merchant/product revenue;
- platform share;
- configured pool contribution;
- any member/referral commissions defined by approved business policy.

### Dividends and pools

Existing allocation/distribution mechanisms should be reused as design input. Their persisted-allocation and idempotent-credit patterns align with the new architecture.

### KasiShares

Share-purchase settlement should remain separate from any future commissions/rewards. Once payment is settled, share fulfilment and any financial distributions consume durable settlement/allocation events rather than embedding payout logic in blockchain verification.

## 10. Suggested data model

The exact schema should be finalized during implementation, but the architecture should contain entities equivalent to:

### `split_policies`
Versioned product/settlement allocation definitions.

### `settlement_allocations`
Immutable calculated outputs for a specific settlement/policy version.

### `payable_accounts`
Beneficiary/currency-level payable balance identity.

### `payable_entries`
Immutable credits/debits that explain payable balance movement.

### `payout_policies`
Versioned threshold/frequency/provider/fee eligibility configuration.

### `payouts`
Outbound payout lifecycle record.

### `payout_events`
Durable outbox/audit events for payout processing and reconciliation.

These may live inside the existing finance/payments resources depending on service ownership and transaction-boundary decisions.

## 11. Idempotency requirements

At minimum, idempotency must cover:

- settlement -> allocation generation;
- allocation -> ledger/payable posting;
- payout aggregation window;
- payout reservation;
- provider submission;
- provider reconciliation;
- payout completion/failure handling.

No retry may duplicate economic value.

## 12. Security and compliance controls

Required controls include:

- server-owned split and payout policies;
- no browser-defined percentages or payout amounts;
- no provider-defined earning amounts;
- KYC/compliance gate before external payout where required;
- role-based administration for policy changes;
- dual approval for high-risk/high-value payout changes where policy requires it;
- complete audit of policy versions and payout-state changes;
- managed secrets for payout-provider credentials;
- destination validation/whitelisting rules where applicable;
- rate/velocity limits;
- anomaly/manual-review triggers;
- no destructive correction of historical earnings; use explicit adjustment entries.

## 13. Observability

Track at minimum:

- value settled;
- value allocated;
- allocation imbalance attempts;
- outstanding payable value;
- beneficiaries below payout threshold;
- payout queue depth;
- payout success/failure rate;
- provider latency;
- retry counts;
- unreconciled payout count/value;
- held/manual-review count/value;
- stale provider-pending payouts.

Financial dashboards should reconcile gross settlement value through allocation and payout liabilities.

## 14. Implementation sequence

### Phase A - Architecture and policy contract

- approve canonical split/payout terminology;
- define versioned split policy model;
- define payout policy model;
- define atomic-unit/remainder rules;
- confirm service/database ownership.

### Phase B - Allocation engine

- settlement allocation tables;
- deterministic allocation calculator;
- balancing invariant;
- versioned policies;
- tests for rounding/remainders/idempotency.

### Phase C - Payable ledger

- payable account/entry model;
- available/reserved/paid/held accounting;
- transactional posting from allocations;
- reconciliation queries.

### Phase D - Payout aggregation

- threshold/frequency rules;
- payout candidate selection;
- atomic reservation;
- batching;
- KYC/hold/limit gates.

### Phase E - Provider adapters

- local/InstaPay payout adapter;
- international payout adapter;
- Remitano only if approved and still required;
- managed secrets;
- provider idempotency/retry handling.

### Phase F - Reconciliation and operations

- provider status reconciliation;
- admin retry/review tools;
- anomaly detection;
- metrics/runbooks;
- manual financial reconciliation workflow.

### Phase G - Product migration

Migrate product domains one at a time:

1. KasiShares, if it produces distributable earnings;
2. marketplace commissions/pools;
3. mall/pool flows;
4. dividends;
5. other commission/referral programmes.

## 15. Executive decisions required

Engineering should not invent these values. Executive/product/compliance approval is required for:

1. exact split percentages by product/transaction type;
2. recipient hierarchy/eligibility for referral and network rewards;
3. handling when a recipient is ineligible/suspended;
4. minimum payout threshold by currency/rail;
5. payout frequency and whether payouts are automatic, requested or hybrid;
6. who bears provider/network payout fees;
7. minimum economical payout after fees;
8. maximum automatic payout and manual-review threshold;
9. local payout destination model through InstaPay;
10. international payout destination/provider model;
11. tax/withholding/reporting treatment where applicable;
12. pool ownership, distribution cadence and eligibility rules.

These decisions should be expressed as versioned configuration/policy, not hard-coded product logic.

## Acceptance criteria

The architecture is complete only when the following are true:

- every settled allocatable amount produces balanced internal allocations;
- historical allocations can be explained by the policy version that created them;
- no product service sends external payouts directly;
- small earnings accumulate safely as payable balances;
- an external payout reserves value before provider submission;
- failed/retried provider calls cannot duplicate payout value;
- provider success is reconciled before marking a payout complete;
- local and international payout rails consume the same internal payable model;
- financial reporting can reconcile settlement -> allocations -> payable liability -> payouts;
- all policy changes and payout transitions are auditable.

## Canonical architecture statement

Kasihub financial truth flows in this order:

```text
Payment -> Settlement -> Allocation -> Ledger -> Payable -> Payout Aggregation -> Outbound Payout Provider -> Reconciliation
```

Payment rails prove value arrived.

Allocation policy decides ownership.

Kasihub's ledger records the obligation.

The payout layer decides when and how eligible value leaves Kasihub.

External providers execute instructions. They never define Kasihub's financial truth.

( |╲ ) / (│╲)
