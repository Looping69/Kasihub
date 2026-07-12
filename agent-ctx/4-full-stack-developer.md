# Task 4 — Shares View: Phase-aware values + Daily Profit Share (ZAR)

**Agent:** full-stack-developer
**Task ID:** 4
**Files touched:**
- `/home/z/my-project/src/lib/types.ts` (extended `Share` interface)
- `/home/z/my-project/src/components/views/shares-view.tsx` (main work)
- `/home/z/my-project/worklog.md` (appended summary)

## Context
The `/api/shares?memberId=xxx` response shape was updated. Each active share now
carries phase-aware fields (`isLegacy`, `currentValuePerShare`,
`currentTotalValue`), and the daily-dividend fields were renamed + switched from
USD to ZAR ("Daily profit share"). The shares view had to be updated to match.

## What changed

### `src/lib/types.ts`
- Added three optional (backwards-compatible) fields to the `Share` interface:
  - `isLegacy?: boolean` — true for Phase 1 BOGO (FREE) shares
  - `currentValuePerShare?: number` — current phase price per share
  - `currentTotalValue?: number` — quantity × currentValuePerShare
- Made optional with `?` so existing code that constructs `Share` objects keeps
  type-checking; the new fields are read with `??` fallbacks in the view.

### `src/components/views/shares-view.tsx`

**`SharesData` interface**
- Replaced `dailyDividendPerShare: number` / `myDailyDividend: number` with
  `dailyProfitSharePerShare: number` (ZAR) / `myDailyProfitShare: number` (ZAR).
- Added `legacyShares: number` (Phase 1 BOGO FREE count).
- Updated comments: `totalValue` → "sum of each share's quantity × its phase
  price"; `shareValuePerShare` → "$39.95 default/legacy value".

**Helpers / computed values**
- Added `fmtZAR = (n) => R ${(n ?? 0).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  next to the existing `fmtUSD`.
- Added `actualPurchaseValue = data.activeShares.reduce((s, x) => s + (x.totalAmount ?? 0), 0)`
  (purchase-price "actual value").

**KasiShares holdings card**
- "Your shares" tile: big line is now `{data.totalShares} shares`. Below it, when
  `legacyShares > 0`, shows `({legacyShares} legacy shares FREE)` in amber;
  otherwise falls back to `{kasiActiveCount} certificate(s)`. Matches
  "20 shares (20 legacy shares FREE)".
- "Total value" tile: big line unchanged (`{fmtUSD(data.totalValue)}`, the
  phase-based current value). Sub-line changed from "at current rate" to
  `(actual value {fmtUSD(actualPurchaseValue)})`. Matches "$500 (actual value
  $1000)".
- Daily mini-row: "Your daily dividend" → "Daily profit share", value
  `fmtZAR(data.myDailyProfitShare)`. "Per share / day" → "Per share" (removed
  "/day"), value `fmtZAR(data.dailyProfitSharePerShare)`.

**Header subtitle**
- "Daily dividends from KasiMall profits." → "Daily profit share from KasiMall &
  KasiMarketplace profits."

**Active KasiShare certificate cards**
- 2×2 grid relabelled: "Price/share" → "Value/share"
  (`fmtUSD(s.currentValuePerShare ?? s.pricePerShare)`); "Total paid" → "Current
  value" (`fmtUSD(s.currentTotalValue ?? s.totalAmount)`).
- Added an amber "Legacy FREE" `Badge` (with `Sparkles`) next to the `Award`
  icon on cards where `s.isLegacy` is true.
- Retracted (Revoked) KasiShare cards kept unchanged (historical purchase values
  via `pricePerShare` / `totalAmount`).
- Print certificate functions unchanged (still use purchase `pricePerShare` /
  `totalAmount` — a print certificate is a record of the purchase, not the
  current phase value).

**"About KasiShares" bullet**
- "Daily percentage of KasiMall profits shared equally between all sold shares."
  → "Daily percentage of KasiMall & KasiMarketplace profits shared equally
  between all sold shares."

## Kept intact (per task spec)
- Active / Retracted `Tabs` with count badges.
- Print certificate buttons (KasiShare amber, Aureus orange).
- Buy KasiShares dialog (phase Select, quantity Input, BOGO breakdown, Confirm
  purchase).
- Share phases list with `Progress` bars + Phase 1 BOGO badge + per-phase Buy
  buttons.
- Aureus Shares section with equation row (× / = visual).
- Framer Motion fade/scale animations.
- Emerald + amber palette (no indigo/blue).
- All existing imports preserved (incl. `DollarSign`).

## Verification
- `bun run lint` → clean (0 errors, 0 warnings).
- `grep` on the file confirms zero remaining matches for `dailyDividend`,
  `myDailyDividend`, `/ day`, `/day`, `Daily dividend`, `KasiMall profits`.
- Dev server (`dev.log`) recompiles cleanly after the edits (`✓ Compiled` with
  no shares-view errors). The pre-existing `vouchers-view` / `refer-view`
  "Module not found" lines in the log are unrelated to this task (separate
  views, separate tasks).

## Notes for downstream agents
- The `Share` type changes are additive (optional fields), so no other consumer
  of `Share` needs updating.
- The shares view expects `/api/shares` to return `legacyShares`,
  `dailyProfitSharePerShare`, `myDailyProfitShare`, and per-share
  `isLegacy`/`currentValuePerShare`/`currentTotalValue`. If the backend hasn't
  shipped these yet, the `??` fallbacks keep the UI rendering sensibly (legacy
  badge hidden, value/share falls back to purchase price, ZAR fields render
  `R 0.00`).
