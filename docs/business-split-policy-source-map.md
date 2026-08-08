# Kasihub Business Split Policy Source Map

Author: Klaasvaakie ( |╲ )

## Purpose

This document maps the current business split rules from the Google Sheet **MEMBERSHIP OPTIONS, MARKETPLACE & CAMPAIGN SPLITS** into the Kasihub settlement, allocation, payable and payout architecture.

Source spreadsheet:

`https://docs.google.com/spreadsheets/d/14bDXR4BV2llAmoliihxXTuTkrE5YyX0bjNg29Fgenvg/edit`

Source reviewed: 2026-08-08

This document preserves the terminology and values currently present in the spreadsheet. It does **not** silently repair, infer or normalize ambiguous business rules. Where the spreadsheet is incomplete or internally inconsistent, the rule is marked **DO NOT CODE YET** until product/executive/compliance clarification is recorded.

## Policy status model

- **SOURCE-DEFINED** - percentage/value/rule is explicitly present in the spreadsheet.
- **DERIVED-BY-FORMULA** - value is produced by an explicit spreadsheet formula.
- **PROPOSAL** - spreadsheet itself describes the item as a suggestion or needing discussion.
- **AMBIGUOUS** - source contains conflicting, incomplete or unexplained accounting logic.
- **DO NOT CODE YET** - implementation must wait for an explicit policy decision.

## Architecture mapping

The spreadsheet describes the **allocation policy** layer of the canonical financial flow:

```text
Payment
  -> Settlement
  -> Allocation
  -> Ledger
  -> Payable
  -> Payout Aggregation
  -> Outbound Payout Provider
  -> Reconciliation
```

The spreadsheet determines who should economically receive value and in what proportions. It must not directly drive provider transfers.

Each approved spreadsheet rule should become a **versioned split policy**. The policy engine produces immutable allocation records. Allocations are then posted into ledger/payable accounts and only later become eligible for external payout.

---

# 1. Individual Adult

Spreadsheet tab: `INDIVIDUAL ADULT`

## Membership components

### Membership A

| Item | Source value | Status |
|---|---:|---|
| Membership A | R140.00 | SOURCE-DEFINED |
| ARC Med - Merchant Account - product 1 | R18.11 | SOURCE-DEFINED, marked incl VAT |
| Product 2 ? | R9.89 | DERIVED-BY-FORMULA (`28 - 18.11`) |

Business-in-a-Box notes include Coida Training, WiFi Installer training, Sales training and future expansion items.

### Membership B

| Item | Source value | Status |
|---|---:|---|
| Membership B | R140.00 | SOURCE-DEFINED |
| Hey Harvey | R25.00 | SOURCE-DEFINED, marked no VAT |
| Product 2 | R3.00 | DERIVED-BY-FORMULA (`28 - 25`) |
| Ecosystem Split | R53.00 | SOURCE-DEFINED |
| Profit | R62.00 | DERIVED-BY-FORMULA (`140 - 25 - 53`) |

### Important accounting ambiguity

The Profit formula does **not** subtract the displayed `Product 2` amount of R3.00.

The spreadsheet therefore simultaneously presents:

- a R3.00 Product 2 component; and
- a Profit formula that ignores that component.

**Status: AMBIGUOUS / DO NOT CODE YET.**

Engineering must not decide whether Product 2 is inside the Ecosystem Split, outside the profit basis, informational only, or accidentally omitted from the formula.

## Profit split

The R62.00 displayed Profit is split as follows:

| Allocation | Percentage | Displayed amount | Status |
|---|---:|---:|---|
| KasiHuB Custodian | 59% | R36.58 | SOURCE-DEFINED / DERIVED |
| KasiPioneer Pool (200 Roots Share Members) | 1% | R0.62 | SOURCE-DEFINED / DERIVED |
| Private Pool | 1% | R0.62 | SOURCE-DEFINED / DERIVED |
| NPO Pool | 1% | R0.62 | SOURCE-DEFINED / DERIVED |
| Kasi Shareholders Pool | 38% | R23.56 | SOURCE-DEFINED / DERIVED |
| **Total** | **100%** | **R62.00** | BALANCED AT DISPLAYED CENTS |

## Pool timing notes

The spreadsheet states that the following pool totals split **every evening at 12**:

- KasiPioneer Pool;
- Private Pool;
- NPO Pool.

For the NPO Pool it also states that if nobody is in the pool, the total accumulates.

### Architecture interpretation

This should become a **distribution cadence policy**, not an immediate payout instruction.

At midnight, the system may calculate/allocate the relevant pool balance to eligible beneficiaries. The resulting beneficiary amounts still enter the internal ledger/payable layer and are subject to payout aggregation rules.

## Upline rule note

The spreadsheet states:

> if there are less than 6 levels above the member, pay the difference into the Kasihub Custodian account

However, the spreadsheet does not define the six level percentages/amounts in this tab.

**Status: AMBIGUOUS / DO NOT CODE YET.**

A complete level-by-level schedule and recipient-resolution rule is required before a six-level network allocation can be implemented.

---

# 2. Individual Child

Spreadsheet tab: `INDIVIDUAL CHILD - parent does KYC via OmneaPay`

The sheet contains a proposal rather than a finalized allocation table:

- `Suggestion`
- `50% savings bucket to earn 6% interest on amount above R100`
- `Same as adult but with savings buckets that need additional discussion and scope from Instapay if we are unable to do it.`

## Policy status

**PROPOSAL / DO NOT CODE YET.**

The source does not define:

- whether 50% applies to every earning, membership benefit or only selected flows;
- when the bucket becomes accessible;
- how the 6% interest is calculated (APR/APY/simple/compound);
- who legally provides the interest-bearing account/product;
- whether the R100 threshold is principal, available balance or average balance;
- interest accrual/pay cadence;
- withdrawal/guardian rules;
- tax/regulatory treatment;
- what happens when the balance falls below R100.

There is also a naming inconsistency in the source:

- tab title references **OmneaPay** for parent KYC;
- sheet text references **Instapay** for savings-bucket scope.

This must be clarified before implementation.

---

# 3. Merchant

Spreadsheet tab: `MERCHANT`

## Source values

| Item | Value | Status |
|---|---:|---|
| Membership B | R250.00 | SOURCE-DEFINED |
| Hey Harvey | R25.00 | SOURCE-DEFINED |
| COIDA ASSIST | R18.11 | SOURCE-DEFINED |
| UIF ASSIST | R18.11 | SOURCE-DEFINED |
| Unlabelled remainder row | R20.78 | DERIVED-BY-FORMULA (`82 - 25 - 18.11 - 18.11`) |
| DIRECT UPLINE INVITE LINK | R60.00 | SOURCE-DEFINED |
| ECOSYSTEM SPLIT | R53.00 | SOURCE-DEFINED |
| Profit | R146.89 | DERIVED-BY-FORMULA (`250 - 25 - 18.11 - 60`) |

## Critical ambiguity in profit basis

The Profit formula subtracts:

- Hey Harvey R25.00;
- COIDA ASSIST R18.11;
- Direct Upline Invite Link R60.00.

It does **not** subtract the separately displayed:

- UIF ASSIST R18.11;
- unlabelled R20.78 value;
- Ecosystem Split R53.00.

The sheet does not explain whether these values are embedded in another amount, funded from another source, informational, or omitted from the profit formula.

**Status: AMBIGUOUS / DO NOT CODE YET.**

The merchant gross-profit basis must be explicitly approved before implementation.

## Merchant profit split

The displayed R146.89 Profit has this percentage policy:

| Allocation | Percentage | Displayed amount | Status |
|---|---:|---:|---|
| KasiHuB Custodian | 59% | R86.67 | SOURCE-DEFINED / DERIVED |
| KasiPioneer Pool (200 Roots Share Members) | 1% | R1.47 | SOURCE-DEFINED / DERIVED |
| Private Pool | 1% | R1.47 | SOURCE-DEFINED / DERIVED |
| NPO Pool | 1% | blank | PERCENTAGE DEFINED, AMOUNT BLANK |
| Kasi Shareholders Pool | 38% | R55.82 | SOURCE-DEFINED / DERIVED |
| **Total** | **100%** |  | PERCENTAGE BALANCED |

The missing NPO Pool amount must not be interpreted as zero merely because the amount cell is blank; the source percentage is explicitly 1%.

### Rounding implication

Independent two-decimal rounding of each percentage allocation can produce a cent-level imbalance against the R146.89 source amount.

The allocation engine therefore requires a deterministic atomic-unit remainder rule. The spreadsheet percentages remain the policy; the engine must decide the final indivisible cent according to the approved remainder rule.

---

# 4. NPO

Spreadsheet tab: `NPO`

The current NPO tab materially mirrors the Individual Adult table:

- Membership A R140.00;
- Membership B R140.00;
- Ecosystem Split R53.00;
- displayed Profit R62.00;
- 59% Custodian;
- 1% KasiPioneer Pool;
- 1% Private Pool;
- 1% NPO Pool;
- 38% Kasi Shareholders Pool.

It also carries the same six-level-upline note and midnight pool-split notes.

The same Membership B profit-basis ambiguity exists because Product 2 R3.00 is displayed but not subtracted by the Profit formula.

**Status: SOURCE-DEFINED percentages, AMBIGUOUS profit basis.**

---

# 5. NPO/NGO Campaign

Spreadsheet tab: `NPO/NGO CAMPAIGN`

Example: `WOLLIES NPO`

## Gross-profit basis

| Item | Amount |
|---|---:|
| Member Subscription | R140.00 |
| TAME Online Vet Consultation | R23.00 |
| 3-3-3 Rule PetAssist Pal | R5.00 |
| Ecosystem Split | R53.00 |
| **Earnings Split (Gross Profit)** | **R59.00** |

The Gross Profit is explicitly formula-derived as:

`140 - 23 - 5 - 53 = 59`

## Campaign split

| Allocation | Percentage | Displayed amount |
|---|---:|---:|
| KasiHuB Custodian | 43% | R25.37 |
| KasiPioneer Pool | 1% | R0.59 |
| Private Pool | 1% | R0.59 |
| Kasi Shareholders Pool | 25% | R14.75 |
| Group Referrer | 15% | R8.85 |
| Referrer NPO | 15% | R8.85 |
| **Total** | **100%** | **R59.00** |

**Status: SOURCE-DEFINED and internally balanced at displayed cents.**

### Architecture mapping

This should become a specific versioned split-policy family such as:

`npo_campaign/<version>`

Recipient resolution must explicitly distinguish:

- Group Referrer;
- Referrer NPO.

If either recipient is absent/ineligible, fallback behavior must be policy-defined rather than silently redirected.

---

# 6. Marketplace Products

Spreadsheet tab: `MARKETPLACE PRODUCTS`

The sheet states:

> all products on MarketPlace to incl VAT

It also includes a Quadruple Play example with Merchant Cost `R599.00` marked `excl VAT` and an Earnings Split (Gross Profit) of `R232.66`.

The relationship between inclusive customer pricing, merchant cost and the R232.66 gross-profit basis should be preserved exactly once the pricing/VAT contract is finalized.

## Marketplace gross-profit split

| Allocation | Percentage | Displayed amount |
|---|---:|---:|
| Free & Paid Member - cashback | 10% | R23.27 |
| KasiHuB Custodian | 27% | R62.82 |
| KasiPioneer Pool (200 Roots Share Members) | 1% | R2.33 |
| Private Pool | 1% | blank |
| KasiMarketPlace Pool (comm from product sold) | 26% | R60.49 |
| Kasi Shareholders Pool | 25% | R58.17 |
| Referrer | 10% | R23.27 |
| **Total** | **100%** |  |

**Status: SOURCE-DEFINED percentages.**

The Private Pool percentage is explicit but its rand amount is blank.

### Rounding implication

Applying ordinary independent cent rounding to every 1/10/25/26/27% line can make the displayed allocation total differ from the R232.66 gross-profit amount.

This is direct evidence that the production allocation engine must:

1. convert the source amount to integer atomic units;
2. calculate all exact policy shares;
3. floor/round according to one documented algorithm;
4. assign remaining indivisible cents deterministically;
5. assert that output units exactly equal input units.

### Additional business notes present in source

The sheet includes notes relating to a WiFi installer opportunity, including:

- once-off installer commission;
- monthly WiFi-subscription commission;
- a question about commission on a yearly R199 fee;
- identifying installer status;
- training/assessment/certification steps;
- member grouping for installers and marketers.

These notes are **not a complete split policy** and must not be converted into financial logic until amounts, eligibility and lifecycle are explicitly approved.

---

# 7. Product Campaign Group

Spreadsheet tab: `PRODUCT CAMPAIGN GROUP`

Example: `WIFI`

## Source pricing

| Item | Amount / rule |
|---|---|
| Example Paid Member Price | R199.00 |
| Example Free Member Price | R199.00 |
| Member benefit | earn 10% cashback per month on own subscription |
| Merchant Cost | R150.00 |
| Earnings Split (Gross Profit) | R49.00 |

## Campaign-group split

| Allocation | Percentage | Displayed amount |
|---|---:|---:|
| Free & Paid Member | 10% | R4.90 |
| KasiHuB Custodian | 24% | R11.76 |
| KasiPioneer Pool (200 Roots Share Members) | 1% | R0.49 |
| Private Pool | 1% | blank |
| KasiMarketPlace Pool (comm from product sold) | 22% | R10.78 |
| Kasi Shareholders Pool | 22% | R10.78 |
| Campaign Referrer - Paid Member | 10% | R4.90 |
| Campaign Manager - Rene / Belinda | 10% | R4.90 |
| **Total** | **100%** |  |

If the blank Private Pool line is treated according to its explicit 1% percentage, the displayed-cent allocations reconcile to R49.00.

**Status: SOURCE-DEFINED percentages; Private Pool amount cell incomplete.**

### Shareholder-pool display note

The sheet includes a note for a `Public button` showing the total shareholder-pool earning paid for the day to incentivise people to purchase shares for additional income.

This should be treated as a **reporting/UX requirement candidate**, not as authority for financial calculation. The public display must read from reconciled ledger/distribution data rather than calculating a second version of the pool amount.

---

# 8. Canonical policy families implied by the spreadsheet

The current source supports at least these distinct split-policy families:

1. `individual_adult_membership`
2. `npo_membership`
3. `merchant_membership`
4. `npo_ngo_campaign`
5. `marketplace_product`
6. `product_campaign_group`

`individual_child` is not yet ready to become an executable policy because its savings/interest model remains a proposal.

Each executable policy version should include:

- policy key;
- version;
- effective start/end;
- gross/allocatable amount basis;
- ordered allocation rules;
- percentage or fixed allocation basis;
- recipient resolver;
- recipient fallback rule;
- remainder rule;
- distribution cadence where applicable;
- payable/payout eligibility classification;
- source-document reference;
- approval metadata.

---

# 9. Small payouts and pool distributions

The spreadsheet strongly supports the architecture decision that small amounts should **not** immediately become external provider transactions.

Examples include recurring values such as:

- R0.49;
- R0.59;
- R0.62;
- R1.47;
- R2.33;
- R4.90;
- R8.85.

These are allocation amounts. They should be posted to internal beneficiary/pool payable balances.

Where the business rule says a pool splits every evening at 12, the event should mean:

1. close/snapshot the eligible pool amount for the distribution window;
2. calculate beneficiary allocations deterministically;
3. post those allocations into beneficiary payable accounts;
4. preserve the full distribution audit trail;
5. allow payout aggregation policy to decide when an external payment is economical/eligible.

This separates **daily earning/distribution cadence** from **external payout cadence**.

---

# 10. Policy decisions required before executable configuration

The spreadsheet is a strong business source but is not yet a complete executable financial contract.

The following decisions must be closed before relevant policies are activated:

## Membership economics

1. Is Adult/NPO Product 2 R3.00 inside the R53 Ecosystem Split, outside the allocatable basis, or accidentally omitted from Profit?
2. What is the authoritative Merchant profit formula and funding source for UIF ASSIST, the R20.78 row and the R53 Ecosystem Split?
3. What is the exact purpose/label of the Merchant R20.78 formula row?

## Network/upline rules

4. What are the exact six upline-level percentages/fixed values?
5. How is each level recipient resolved?
6. When a level is absent, is that level's full allocation always redirected to KasiHuB Custodian?
7. How are ineligible/suspended uplines handled?

## Pool rules

8. Define eligibility for Pioneer, Private, NPO, Marketplace and Shareholders pools.
9. Confirm which pools distribute at midnight and in which timezone.
10. Confirm whether empty pools accumulate indefinitely, expire, redirect or follow another rule.
11. Define the snapshot boundary and late-event handling for daily pools.

## Rounding

12. Approve one atomic-unit remainder algorithm for all split policies.
13. Define a deterministic remainder recipient/order where exact percentages cannot be represented in cents.

## Child savings proposal

14. Confirm whether the child savings bucket is approved at all.
15. Confirm the 50% source/basis and accessibility rules.
16. Define the 6% interest model and responsible regulated/provider party.
17. Resolve OmneaPay vs Instapay naming/ownership in the child flow.

## Campaign and marketplace rules

18. Define missing-recipient fallback for Group Referrer, Referrer NPO, general Referrer, Campaign Referrer and Campaign Manager.
19. Clarify the WiFi installer/marketer commission notes before implementation.
20. Confirm VAT/gross-profit calculation rules used to establish the allocatable marketplace amount.

---

# 11. Implementation rule

The spreadsheet remains the business-policy source until a policy is approved and versioned in Kasihub.

The system must never execute live splits by reading mutable spreadsheet cells at runtime.

Approved values must be promoted into immutable/versioned server-side policy configuration with:

- explicit approver;
- effective date;
- source revision/reference;
- policy hash/version;
- audit history.

Changing a spreadsheet later must not retroactively change historical allocations.

## Canonical rule

**Spreadsheet proposes/records business economics. Versioned Kasihub policy executes them. Ledger records the result. Payout aggregation controls external movement.**

( |╲ ) / (│╲)
