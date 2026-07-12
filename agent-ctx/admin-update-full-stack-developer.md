# Task admin-update — Admin views: marketplace free-price + shares phase-based value & daily profit share

**Agent:** full-stack-developer
**Task ID:** admin-update
**Files touched:**
- `/home/z/my-project/src/components/admin/admin-marketplace.tsx`
- `/home/z/my-project/src/components/admin/admin-shares.tsx`
- `/home/z/my-project/worklog.md` (appended summary)
- `/home/z/my-project/agent-ctx/admin-update-full-stack-developer.md` (this file)

## Prior agent context reviewed
- `agent-ctx/4-full-stack-developer.md` — task 4 updated the member-facing `shares-view.tsx`:
  renamed "Daily dividend" → "Daily profit share", switched per-share + my-share fields from
  USD to ZAR (~R37,000 pool), added `legacyShares` count + per-share `isLegacy` /
  `currentValuePerShare` / `currentTotalValue` optional fields to the `Share` type, added
  "Legacy FREE" badge on Phase 1 BOGO cards. This task mirrors those changes in the admin
  equivalents.
- `/api/admin/marketplace/route.ts` — already returns `freeMemberOrders`/`paidMemberOrders`,
  per-product `freePrice`/`freePriceDelta`, per-category `freeOrders`/`paidOrders`, per-order
  `pricingTier`. Already accepts `freePrice` on POST (defaulting to `price × 1.15`) and PATCH.
- `/api/admin/shares/route.ts` — returns `shares`, `totalActiveShares`, `totalActiveValue`
  (sum of `totalAmount`, i.e. purchase value).
- `/api/admin/dividends/route.ts` — POST accepts `amount` (any currency) and returns
  `perShareAmount` / `distributedTo`. No currency field on the model, so the label change
  from USD to ZAR is purely client-side.
- `prisma/schema.prisma` — `MarketplaceProduct.freePrice` (Float, default 0),
  `MarketplaceOrder.pricingTier` (default "PAID"), `SharePhase.bonusBuyOneGet` (default false).

## What changed

### `src/components/admin/admin-marketplace.tsx`

**Interfaces / state**
- Extended `Product` interface with `freePrice: number` and `freePriceDelta: number`.
- Extended `Order` interface with `pricingTier: "PAID" | "FREE"`.
- Added a new `CategoryStat` interface (typed) that includes `freeOrders`/`paidOrders`.
- Extended `totals` state to include `freeMemberOrders` + `paidMemberOrders` (with `?? 0`
  fallbacks for safety in case the API ever omits them).
- `EMPTY_PRODUCT` now seeds `freePrice: 0` so the create dialog starts with an empty
  (not undefined) free-price field — keeps the input controlled.

**Stats grid (spec points 1 & 5)**
- Expanded from `sm:grid-cols-4` to `sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6`.
- Kept the 4 original cards (Total products / Total orders / Total revenue / Commission).
- Added 5th card: "Paid member orders" (emerald ring, `Crown` icon) — `totals.paidMemberOrders`.
- Added 6th card: "Free member orders" (amber ring, `Sparkles` icon) — `totals.freeMemberOrders`.
- Each card has a short sub-line of context ("subscribed members" / "FREE tier members").

**Category revenue grid (spec point 5)**
- Each category cell now also shows two small outline badges below a `Separator`:
  emerald "{paidOrders} paid" + amber "{freeOrders} free".

**Products table (spec point 2)**
- Renamed the "Price" header to "Member price" and inserted a new "Free price" column between
  member price and commission.
- Free-price cell logic: if `freePrice` is 0 or equals `price`, render a muted "Same" label;
  otherwise render `fmt(freePrice)` in amber-700/dark amber-400 with a `+N%` delta outline
  badge below (uses `p.freePriceDelta`; signed delta so a discount would show "-N%").

**Recent orders card (spec point 4)**
- Header now includes two summary badges ("X paid" / "Y free").
- Each order row gets an inline tier badge next to the product name — emerald "PAID" or
  amber "FREE" outline badges, driven by `o.pricingTier`.

**Edit/Create dialog (spec point 3)**
- Restructured the price/commission/rating grid into a 2-col price grid (Price (R) + Free
  member price (R)) plus a separate 2-col commission/rating grid.
- Label "Free member price (R)" with helper text "Price for free members (usually 15%
  higher than member price)." — verbatim from the spec.
- Helper text "Base price for paid members." added under the price field for symmetry.
- Bonus: an amber info box appears when both prices are set and differ, showing the
  computed percentage difference — useful immediate feedback for the admin.

**Save (spec point 6)**
- `save()` already spreads `editing` into the request body, so `freePrice` is automatically
  included on both POST (create) and PATCH (update). The route already accepts the field.
- No change to `save()` body construction was needed.

**Imports**
- Added `Crown` and `Sparkles` from lucide-react.
- Removed the `motion` import from framer-motion that the original file declared but never
  used (would have been an eslint warning).

### `src/components/admin/admin-shares.tsx`

**Module-level constant + helpers**
- `DAILY_PROFIT_POOL_ZAR = 37000` — centralised ~R37,000/day pool assumption.
- Added `fmtZAR = (n) => R ${(n ?? 0).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` next to the existing `fmtUSD`.
- `phase1IsLegacy = phases.find((p) => p.phase === 1)?.bonusBuyOneGet === true`.
- `phasePriceFor(s)` — looks up the share's phase price in `phases` (falls back to `s.pricePerShare`).
- `isLegacyShare(s)` — `s.phase === 1 && phase1IsLegacy`.
- `totalPhaseValue` — `shares.filter(ACTIVE).reduce((sum, s) => sum + s.quantity * phasePriceFor(s), 0)`.
- `dailyProfitSharePerShare` — `DAILY_PROFIT_POOL_ZAR / totals.totalActiveShares` (0 if no shares).

**Stats grid (spec point 2)**
- Expanded from 3 to 4 cards (`sm:grid-cols-2 lg:grid-cols-4`).
- Card 1 "Active shares outstanding" — unchanged count, added sub-line "across N
  certificate(s)".
- Card 2 "Total value sold (purchase)" — `fmtUSD(totals.totalActiveValue)` (USD), added
  sub-line "sum of original purchase amounts".
- Card 3 (NEW) "Current value (phase-based)" — `fmtUSD(totalPhaseValue)` (emerald ring),
  sub-line "sum of qty × phase price".
- Card 4 (NEW) "Daily profit share / share" — `fmtZAR(dailyProfitSharePerShare)` (amber ring,
  `Sparkles` icon), sub-line "R 37,000.00 pool / day".

**Phases management card**
- Kept all phase rendering (icon, status badge, sold progress bar, Edit button).
- BOGO badge behaviour unchanged.
- Phase edit dialog BOGO switch sub-text updated to "Phase 1 bonus special (legacy FREE
  shares)" — ties the toggle to the new legacy framing.

**Profit share history card (spec point 1)**
- Header renamed "Dividend history" → "Profit share history".
- Each dividend card now shows `fmtZAR(d.amount)` (was `fmtUSD`) and `fmtZAR(d.perShareAmount)`
  (was `fmtUSD`). Note: historical amounts are stored as-sent; going forward they're sent in
  ZAR by the updated dialog.
- Empty state copy: "No profit shares declared yet."

**All certificates table (spec points 3, 4, 5)**
- Added "Phase price" column (`fmtUSD(phasePriceFor(s))`) and "Current value" column
  (`fmtUSD(s.quantity × phasePriceFor(s))`, emerald font-semibold).
- Phase cell now includes an amber "Legacy" outline badge (with `Sparkles` icon) for
  certificates where `isLegacyShare(s)` is true.
- Status badge styling: ACTIVE = emerald; non-ACTIVE (e.g. RETRACTED) = rose — keeps
  retracted certs visible per spec point 6 ("Keep all existing features: retracted
  certificates if visible").
- Added a `tfoot` row that aggregates the active certificates' phase-based totals —
  "Total (active certificates, phase-based)" label, total active shares count, and a bold
  emerald `fmtUSD(totalPhaseValue)`. This is the spec's "Total value should reflect
  phase-based pricing" requirement.

**Declare dialog (spec points 1 & 2)**
- Title "Declare dividend" → "Declare daily profit share".
- Label "Total dividend amount (USD)" → "Total profit share amount (ZAR)".
- Default `dividendAmount` state "50000" → "37000".
- Helper text now mentions "The daily profit pool is approximately R 37,000.00."
- Per-share row uses `fmtZAR`.
- Success toast format: `R X.XXXX/share distributed to N members` (was `$X.XXXX/share`).
- Distribution info note ("immediately distributed ... DIVIDEND transaction, paid to their
  Roots Bank accounts") kept verbatim — the transaction type is still `DIVIDEND` server-side.

**Imports**
- Added `Sparkles` to the lucide-react import list.
- Removed the unused `motion` (framer-motion) and `Plus` imports that the original file
  declared but never used (would have been eslint warnings).

## Verification
- `bun run lint` → clean (0 errors, 0 warnings).
- `tail -40 /home/z/my-project/dev.log` → most recent lines show `✓ Compiled in NNNms` and
  `GET /api/admin/stats 200` responses after the edits. The pre-existing "Module not found
  '@/components/admin/admin-notifications'" error in the log is unrelated to this task
  (referenced by `admin-shell.tsx`, not touched here).
- No new compile errors related to either edited file.

## Notes for downstream agents
- The marketplace admin view expects `/api/admin/marketplace` to return the new fields. The
  route already does (verified at `/src/app/api/admin/marketplace/route.ts`), so no backend
  work was needed. If a field is missing, the UI degrades gracefully thanks to `?? 0` /
  optional-chaining fallbacks.
- The shares admin view's "Daily profit share / share" stat and the declare-dialog default
  both assume a ~R37,000/day pool. If the actual pool changes, update
  `DAILY_PROFIT_POOL_ZAR` in `admin-shares.tsx`.
- Historical dividend records in the database are stored without a currency field. The UI
  now displays them as ZAR — if some old declarations were actually in USD, those cards will
  show the wrong unit. A future migration could add a `currency` column to
  `DividendDeclaration` if this becomes a real concern.
- The phase-based `Current value` column for a certificate uses the *current* phase price,
  not the historical purchase price. This matches the member view's
  `currentValuePerShare`/`currentTotalValue` semantics (see task 4 notes).
