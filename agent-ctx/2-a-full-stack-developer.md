# Task 2-a — Dashboard View Rewrite

**Agent**: full-stack-developer
**Date**: 2025
**Scope**: Rewrite `src/components/views/dashboard-view.tsx` to consume the new `/api/dashboard` response shape.

## Summary of work
- Updated `src/lib/types.ts` `DashboardStats` interface to match the new API shape (3 pools, kasiShares/aureusShares/rootsBankShares objects, totalEarningsTrend, auditorNotified, ecosystemDownline/Levels, earningsToday/Week/Month, ecosystemEarningsToday). Added a new `PoolDistribution` interface.
- Completely rewrote `src/components/views/dashboard-view.tsx` with the following structure:

### Layout sections (top to bottom)
1. **Welcome header** — member name, profile number, "Buy shares" + "Marketplace" buttons. Includes the new **Auditor notification badge** (`Auditor notified — earnings exceeded R7,000/mo`) next to the welcome text, shown only when `stats.auditorNotified` is true.
2. **KPI Row (4 cards)**:
   - Total Earnings — emerald
   - This Month (`earningsThisMonth`) — amber
   - KasiShares value (`kasiShares.totalValue`, formatted as `$X,XXX`) — yellow
   - Ecosystem Downline (`ecosystemDownline` + "levels deep" sub) — teal
3. **Ecosystem Earnings Today block** — large card with prominent `ecosystemEarningsToday` amount, plus 3 mini-stats (Daily = `earningsToday`, Weekly = `earningsThisWeek`, Monthly = `earningsThisMonth`).
4. **3 Pool Blocks**:
   - **Pioneer KasiPool** — only rendered if `pools.pioneer.eligible` is true. Amber/gold themed. Subtitle "1% of Kasi profits". Shows today/total. Includes the "You're receiving a share of the 1% PioneerPool every night." note.
   - **KasiMarketplace Pool** — teal themed. Subtitle "Paid Enablers Only". Shows today/total. Note "This amount is included in your Total Earnings for today."
   - **Kasi Shareholders Pool** — emerald themed. Subtitle "Shareholders only". Shows today/total. Includes "Buy shares" button calling `setView("shares")`.
5. **Shares Blocks (3)**:
   - KasiShares — count, value per share (`$39.95` from `kasiShares.valuePerShare`), total value (USD).
   - Aureus Shares — count, value per share (`$15.00` from `aureusShares.valuePerShare`), total value (USD).
   - Roots Bank Shares — count, total value (R, ZAR).
6. **Charts**:
   - **Total Earnings** area chart — 14 days, emerald gradient, uses `totalEarningsTrend` data (NOT `earningsTrend`). Title updated to "Total Earnings".
   - **Earnings breakdown** pie chart — uses `earningsBreakdown`. The API already returns "Eco-System Commission" as the label (no longer "Matrix Commission"). Empty state added.
7. **3-card row**:
   - **Eco-System (5×6)** — title changed from "Ecosystem (5×6)", subtitle changed from "Forced matrix position" to "5×6 structure", button text "View Eco-System". Shows `ecosystemDownline` and `ecosystemLevels`.
   - **Pioneer Pool** — if `pioneerPoolEligible`: shows "Eligible" badge + "You're receiving a share of the 1% PioneerPool every night." text. Otherwise: "Claim pioneer spot" button calling `setView("rootsbank")`.
   - **Profile** — KYC status, subscription status, NFC tag, VISA card last4. Added "—" fallback for null values.
8. **Recent transactions** — same layout, but transaction types are translated: `MATRIX_PAYOUT` → "Eco-System Commission" (instead of "MATRIX PAYOUT"). Added empty state.

## Technical details
- `"use client"` at top.
- Imports `useKasiStore` from `@/lib/store`.
- Uses shadcn/ui: `Card`, `Badge`, `Button`, `Progress`.
- Uses Recharts: `AreaChart`, `Area`, `ResponsiveContainer`, `Tooltip`, `XAxis`, `YAxis`, `CartesianGrid`, `PieChart`, `Pie`, `Cell`.
- Uses Framer Motion `motion.div` for entrance animations on KPI/Pool/Share cards.
- Uses lucide-react icons: `Wallet`, `TrendingUp`, `Users`, `Coins`, `ArrowUpRight`, `ArrowDownRight`, `Sparkles`, `Award`, `Network`, `Loader2`, `Crown`, `ShoppingBag`, `PieChart as PieChartIcon`, `Gem`, `Landmark`, `BellRing`, `Calendar`.
- Color palette: emerald + amber/gold + teal accents. No indigo/blue.
- Currency formatters exactly as specified:
  - `const fmt = (n) => \`R ${n.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\``
  - `const fmtUSD = (n) => \`$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\``
- All "Forced matrix" references removed (now "Eco-System").
- All `earningsTrend` references removed (now `totalEarningsTrend`).
- All `poolShareTotal` references removed (replaced with 3 pools).
- Reusable sub-components: `KpiCard`, `MiniStat`, `PoolBlock`, `ShareBlock` — all themed (emerald/amber/teal/yellow).
- Responsive: mobile-first grid (1 col → 2 cols sm → 3-4 cols lg).
- Scrollable transaction list with `max-h-96 overflow-y-auto scrollbar-kasi`.
- Long list handling: earnings breakdown legend and transactions list both have max-height + scrollbar styling.

## Verification
- `bun run lint` → passes cleanly (no errors or warnings).
- The pre-existing dev.log error about `@/components/views/legal-view` is **unrelated** to this task — that's a separate missing view file owned by another task.

## Files changed
- `src/lib/types.ts` — updated `DashboardStats` interface + new `PoolDistribution` interface.
- `src/components/views/dashboard-view.tsx` — complete rewrite (~600 lines).
