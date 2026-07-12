# KaSiHUB Worklog — Phase 2 Frontend Rework

## Context
KaSiHUB is a Next.js 16 app (App Router, TypeScript, Tailwind CSS 4, shadcn/ui).
The backend APIs have been updated to support:
- 3 KasiPools (PIONEER, MARKETPLACE, SHAREHOLDERS) via `poolType` field on KasiPoolDistribution
- Daily/weekly/monthly earnings on the dashboard API
- Aureus shares (new model)
- Share value at $39.95 (stored in settings as `kasi_share_current_value_usd`)
- InstaPay verification API at POST /api/instapay/verify
- Legal documents API at GET /api/legal?type=terms|tax|privacy
- citizenshipType, instapayStatus, uplineConfirmed fields on Member
- Auditor auto-notification when monthly earnings > R7000

## Key API Response Shapes

### GET /api/dashboard?memberId=xxx returns:
```
{
  member: Member,
  totalEarnings: number,
  monthlyEarnings: number,
  earningsToday: number,          // today's positive transactions
  earningsThisWeek: number,      // Mon-Sun
  earningsThisMonth: number,     // 1st to last day
  ecosystemEarningsToday: number,
  pools: {
    pioneer: { total, today, eligible, distributions[] },
    marketplace: { total, today, distributions[] },
    shareholders: { total, today, eligible, distributions[] }
  },
  kasiShares: { count, valuePerShare: 39.95, totalValue },
  aureusShares: { count, valuePerShare: 15.00, totalValue },
  rootsBankShares: { count, totalValue },
  ecosystemDownline: number,
  ecosystemLevels: number,
  pioneerPoolEligible: boolean,
  auditorNotified: boolean,
  transactions: Transaction[],
  totalEarningsTrend: { date, amount }[],   // 14 days — REPLACES earningsTrend
  earningsBreakdown: { name, value, color }[]
}
```

### GET /api/shares?memberId=xxx returns:
```
{
  phases: SharePhase[],
  activeShares: Share[],           // ACTIVE certificates
  retractedShares: Share[],        // REVOKED certificates
  aureusShares: AureusShare[],     // ACTIVE Aureus
  retractedAureusShares: AureusShare[], // RETRACTED Aureus
  totalShares: number,
  totalValue: number,              // = totalShares × shareValuePerShare
  shareValuePerShare: 39.95,
  aureusValuePerShare: 15.00,
  aureusTotalShares, aureusTotalValue,
  dailyDividendPerShare, myDailyDividend, totalSharesOutstanding
}
```

### POST /api/instapay/verify accepts:
```
{ memberId, idNumber?, passportNumber?, asylumNumber?, companyRegNo?, npoNgoNumber? }
```
Returns: `{ verified: boolean, accountRef?: string, member?: Member }`

### GET /api/legal?type=terms|tax|privacy returns:
```
{ document: { title, lastUpdated, content: [{ heading, body }] } }
```

## Design Standards
- Colors: emerald + amber/gold (NO indigo/blue). Dark sidebar.
- Use existing shadcn/ui components from src/components/ui/
- Use `useKasiStore` from `@/lib/store` for state
- "Forced matrix" → "Eco-System" everywhere
- Remove "No recruitment required" text everywhere
- Remove the 25% tax sentence from ecosystem info
- Remove upline chain block from ecosystem view
- Framer Motion for animations, Recharts for charts
- All currency in ZAR (R) unless explicitly USD ($)

## Task 2-a — Dashboard View Rewrite (Agent: full-stack-developer)
- Updated `src/lib/types.ts` `DashboardStats` interface to match the new API shape (3 pools, kasiShares/aureusShares/rootsBankShares, totalEarningsTrend, auditorNotified, ecosystemDownline/Levels, earningsToday/Week/Month, ecosystemEarningsToday). Added `PoolDistribution` interface.
- Completely rewrote `src/components/views/dashboard-view.tsx`:
  - KPI Row (4 cards): Total Earnings (emerald), This Month (amber), KasiShares value USD (yellow), Ecosystem Downline + levels deep (teal).
  - Ecosystem Earnings Today block: prominent `ecosystemEarningsToday` amount + Daily/Weekly/Monthly mini-stats.
  - 3 Pool Blocks: Pioneer KasiPool (only if `pools.pioneer.eligible`, amber), KasiMarketplace Pool (teal, "Paid Enablers Only"), Kasi Shareholders Pool (emerald, with "Buy shares" button → `setView("shares")`).
  - 3 Shares Blocks: KasiShares (USD, $39.95/share), Aureus Shares (USD, $15.00/share), Roots Bank Shares (ZAR).
  - Total Earnings area chart (14 days, emerald gradient) using `totalEarningsTrend`. Title "Total Earnings".
  - Earnings breakdown pie chart (unchanged shape; API now returns "Eco-System Commission" label).
  - 3-card row: Eco-System (5×6) / "5×6 structure" / `ecosystemDownline` + `ecosystemLevels`; Pioneer Pool card (Eligible badge OR Claim spot); Profile card.
  - Recent transactions: `MATRIX_PAYOUT` → "Eco-System Commission" label.
  - Auditor notification badge in welcome header when `auditorNotified` is true.
- Removed all references to: `poolShareTotal`, `earningsTrend`, `matrixDownline`, `matrixLevels`, `shareCount`, `shareValue`, `dailyDividend`, "Forced matrix".
- `bun run lint` passes cleanly.
- Work record: `agent-ctx/2-a-full-stack-developer.md`.


## Task 2-d — Registration Wizard Rewrite (Agent: full-stack-developer)
- Extended `src/lib/types.ts`:
  - Added `CitizenshipType` union (8 values: SA_CITIZEN_SA, FOREIGN_CITIZEN_SA, SA_CIPC_COMPANY, SA_SOLE_PROPRIETOR, SA_NPO_NGO, SA_CITIZEN_ABROAD, FOREIGN_CITIZEN_ABROAD, INTL_COMPANY).
  - Extended `MembershipType` to include `SOLE_PROPRIETOR`, `NPO_NGO`, `FREE` (backwards-compatible — only added values).
- Completely rewrote `src/components/registration-wizard.tsx` with the new 5-step flow:
  - **Dialog width**: `w-[90vw] max-w-[1100px]` (90% of screen, max ~1100px).
  - **Step 1 — Citizenship**: 8 radio-card options in a 2-column grid (RadioGroup + clickable Cards) with title + short description + icon. Plus upline/sponsor input with debounced lookup via `/api/admin/members?search=...` (gracefully falls back to showing the profile number itself if the API fails or no match). Confirmation checkbox text adapts: "I confirm that [upline name] is my upline" (when upline entered) OR "I confirm that I am joining via bulk registration" (when blank). The "Continue" button is disabled until citizenship is selected AND the checkbox is ticked.
  - **Step 2 — InstaPay** (only renders when `citizenshipType ∈ {SA_CITIZEN_SA, SA_NPO_NGO}` — other types skip this step entirely thanks to dynamic `getSteps()`). Two options: (a) Download InstaPay Gini app — fetches Android/iOS URLs from `GET /api/instapay/status` and renders Google Play / App Store buttons with `ExternalLink` icons; (b) Verify existing account — shows identifier fields based on citizenship (ID/Passport/Asylum for individuals; Company Reg / NPO-NGO Number for NPOs). Verify button simulates verification client-side (accepts any 6+ char identifier per task spec, since there's no memberId yet) and sets `instapayStatus=VERIFIED`, `instapayAccountRef`, `instapayVerifiedAt`. Success state shows verified badge + account ref. Note: "Subscription is processed via InstaPay Gini with Adamo subscription integration".
  - **Step 3 — Membership & Subscription**: SA members (SA_CITIZEN_SA, FOREIGN_CITIZEN_SA, SA_CIPC_COMPANY, SA_SOLE_PROPRIETOR, SA_NPO_NGO) see SA pricing — R140 Individual / R300 Company-SoleProp / R250 NPO-NGO / R0 Free. International members (SA_CITIZEN_ABROAD, FOREIGN_CITIZEN_ABROAD, INTL_COMPANY) see USD pricing — $30 Adult / $30 Kid / $50 Company / $0 Free. Default membership pre-selected based on citizenship type. Payment method card shows "InstaPay Gini" (SA) or "Bankus Platform" (intl) with the appropriate note. Removed all Bank/Card/Cash options. Removed Solidus Holdings bank details card entirely.
  - **Step 4 — Details**: Adapts fields to citizenship type — companies get company name + reg no, NPO/NGO gets org name + NPO number, sole proprietor gets business name + personal ID, individuals get first/last name + ID/passport (+ SARS for SA individuals). International individuals see "Passport number" instead of "ID/Passport". Common: email, mobile, country (now with placeholder + more options including intl), city, postal code, address textarea, beneficiary name + ID.
  - **Step 5 — Review & Confirm**: Shows summary card with all data (citizenship, membership, upline, InstaPay status, payment method, entity details, contact info, beneficiary). Removed NFC Tag mention. Removed VISA card mention. Changed "matrix" → "Eco-System". Removed "You'll be placed in the next open spot..." sentence — replaced with "Your profile will be created and you'll get access to the KaSiHUB UI." Kept bullet about unique profile number and Eco-System placement. Re-displays upline confirmation tick if upline was provided.
  - **Done step**: Keeps the spring-animated success badge + profile number display. Says "Eco-System" (not matrix). No NFC mention. Button label: "Enter the Eco-System".
- Removed KYC step entirely. Removed the separate "Profile" step (merged into Review). New step order: type → instapay (conditional) → subscription → details → review → done.
- FormData interface includes all required fields: `citizenshipType`, `membershipType`, `uplineProfileNumber`, `uplineConfirmed`, `instapayStatus`, `instapayAccountRef`, `instapayVerifiedAt`, plus `uplineName`, `instapayOption`, and the 5 InstaPay verify identifiers.
- Submit (`POST /api/members`) sends all form data including the new citizenship/instapay/upline fields. Adapts payload based on citizenship (company fields, individual fields, NPO fields, sole prop fields).
- Uses shadcn/ui Dialog, Button, Input, Label, RadioGroup, RadioGroupItem, Card, Badge, Checkbox, Separator, Textarea. Emerald + amber color palette throughout. Framer Motion transitions between steps. `useKasiStore` for `closeRegistration` and `login`. `toast` from sonner for notifications.
- `bun run lint` passes cleanly (0 errors, 0 warnings).
- Note: pre-existing dev server error `Module not found: '@/components/views/legal-view'` is unrelated to this task (a separate task in the Phase 2 rework).
- Work record: `agent-ctx/2-d-full-stack-developer.md`.


## Task 2-b — Eco-System View Rewrite (Agent: full-stack-developer)
- Completely rewrote `src/components/views/ecosystem-view.tsx`:
  - **Header**: "5 × 6 Forced Ecosystem" → "5 × 6 Eco-System". Removed "no recruitment required to earn" wording; replaced with "spillover from upline fills your Eco-System downline". "Forced matrix position" → "5×6 structure".
  - **New 3 earnings blocks** (sm:grid-cols-3) above the stats strip:
    - Daily Earnings (emerald, Wallet icon, "Today") from `earningsToday`
    - Weekly Earnings (amber, Calendar icon, "Mon – Sun") from `earningsThisWeek`
    - Monthly Earnings (teal, TrendingUp icon, "1st – last day") from `earningsThisMonth`
    - Each is a gradient card with ring tint, big `R X,XXX.XX` value formatted via `formatZAR` (`en-ZA`, 2 dp), label + sublabel + icon chip. Framer Motion fade-up.
  - **Stats strip**: relabelled "Your downline" → "Eco-System downline". Replaced removed "Upline chain" stat with "Total spots" (= 19,530). Kept "Monthly commission" (emerald) and "Levels filled (X / 6)". Added small icons in each stat label.
  - **Removed the entire "Your upline" card** — no upline chain rendered anywhere.
  - **Level breakdown**: removed the green "No recruit required" badge in the header. Each level row now uses its distinct color: L1 emerald, L2 teal, L3 amber, L4 orange, L5 rose, L6 violet. The level number badge uses a `from-{c}-500 to-{c}-600` gradient; the percent text uses `text-{c}-600`; the active row uses `{c}-50`/`{c}-950/30` background with `ring-{c}-300`. The progress bar is now a custom div (not shadcn `Progress`) so the fill uses the exact level color via inline `backgroundColor: oklch(...)`. Framer Motion animates width on mount.
  - **Tree visualization**: heading "Matrix tree" → "Eco-System tree". Legend expanded to show all 6 level colors (L1 emerald … L6 violet) + "You" + "Open spot". Each non-me node is tinted with its level color: a 12% opacity overlay using the level's oklch color, plus level-colored border (`border-{c}-200 dark:border-{c}-900`) and `hover:border-{c}-400`. The "you" node keeps the emerald→amber gradient. Node icon uses the level color text. Empty spots use the level color dashed border. Tooltip now includes "Level X · {colorName}".
  - **Color mapping**: `colorForLevel(level)` returns `LEVEL_COLORS[max(0, min(5, level-1))]` — so tree level 0 (root) and level 1 both map to emerald (idx 0), level 2 → teal, etc., matching the table's L1…L6 → idx 0…5.
  - **Info card**: heading "How the 5 × 6 matrix works" → "How the 5 × 6 Eco-System works". All bullet text "matrix" → "Eco-System". Removed the 25% tax / IRP5 bullet entirely. Changed "No recruitment is required to earn from the matrix. Spillover from upline fills your downline." → just "Spillover from upline fills your downline.".
  - **APIs**: matrix data still fetched from `/api/matrix?memberId=...` (uses `matrixDownline` shape internally — unchanged). New `/api/dashboard?memberId=...` fetch (parallel `Promise.all` with matrix fetch) supplies `earningsToday` / `earningsThisWeek` / `earningsThisMonth`.
- Cleanup: removed unused imports (`Badge`, `Button`, `Separator`, `ChevronUp`, `GitBranch`, `Crown`-only helper, etc.). Added `Wallet`, `Calendar`, `TrendingUp`, `GitFork`, `Users` imports.
- `MatrixData` interface still keeps `upline` field (API still returns it) but it is never rendered.
- `bun run lint` passes cleanly (0 errors, 0 warnings).
- Pre-existing dev server error `Module not found: '@/components/views/legal-view'` is unrelated to this task.
- Work record: `agent-ctx/2-b-full-stack-developer.md`.


## Task 2-c — Shares View Rewrite (Agent: full-stack-developer)
- Extended `src/lib/types.ts` with a new `AureusShare` interface (id, phase, pricePerShare, quantity, totalAmount, certificateNo, prevCertificateNo, status `ACTIVE|RETRACTED`, createdAt) to mirror the Prisma `AureusShare` model used by `/api/shares`.
- Completely rewrote `src/components/views/shares-view.tsx`:
  - **New `SharesData` interface** matches the updated API response: `activeShares`, `retractedShares`, `aureusShares`, `retractedAureusShares`, `totalShares`, `totalValue` (= totalShares × shareValuePerShare), `shareValuePerShare` ($39.95), `aureusValuePerShare` ($15.00), `aureusTotalShares`, `aureusTotalValue`, `dailyDividendPerShare`, `myDailyDividend`, `totalSharesOutstanding`. Removed the old single `shares` array.
  - **KasiShare value equation card** (NEW): a single gradient Card showing the visual equation `Your shares × Share value = Total value`. Left tile shows `totalShares` + certificate count; middle tile shows `$39.95 / share` from `shareValuePerShare` (NOT purchase price); right tile shows `totalValue` formatted as `$X,XXX.XX` (= totalShares × shareValuePerShare). Dividend mini-row below shows `myDailyDividend` (emerald) and `dailyDividendPerShare` + `totalSharesOutstanding`.
  - **Aureus Shares section** (NEW): a parallel gradient Card (orange/amber palette, `Gem` icon) with the same equation layout: `aureusTotalShares × aureusValuePerShare ($15.00) = aureusTotalValue`. Shows the per-share value badge prominently.
  - **Print certificate buttons** (NEW): every active KasiShare certificate card has a "Print" button (outline, amber border, `Printer` icon). Every active Aureus certificate card has a matching orange Print button. Clicking calls `printKasiCertificate(share, memberName)` / `printAureusCertificate(share, memberName)` which `window.open("", "_blank")` a new window, writes a full standalone HTML document with a decorative double-border + corner ornaments + gold seal + 2-column field grid (Certificate No., Phase, # shares, price/share, total amount, date issued) + "Solidus Holdings (Pty) Ltd" footer, and triggers `window.print()` on load. Shows a sonner toast error if pop-ups are blocked. The member name is derived from `useKasiStore().currentMember` via `memberDisplayName()` (company name for COMPANY/NPO_NGO/SOLE_PROPRIETOR, else firstName+lastName, else email).
  - **Tabs for Active vs Retracted certificates** (NEW): shadcn `Tabs` with two `TabsTrigger`s — "Active" (default, emerald-tinted, with count badge) and "Retracted" (rose-tinted, with count badge). Active tab shows active KasiShare certificates (amber gradient cards) followed by active Aureus certificates (orange gradient cards). Retracted tab shows REVOKED KasiShares and RETRACTED Aureus shares in a muted/strikethrough style — dashed border, `bg-muted/30`, `opacity-70`, certificate number/title/phase/quantity all `line-through`, with a rose "Revoked" or "Retracted" badge. Retracted cards have no Print button. Empty states for both tabs.
  - **Kept existing features**: KasiShare phases list with `Progress` bars + BOGO badge + Buy buttons (untouched); Buy KasiShares dialog (Select phase, quantity input, BOGO breakdown, Confirm purchase button) unchanged; "About KasiShares" info card with green-check bullets untouched; Framer Motion fade/scale animations preserved; emerald + amber palette; `formatUSD` uses `en-US` with 2 dp for all share values.
  - Removed unused `ArrowUpRight` and `DollarSign` imports from lucide; added `Gem`, `Printer`, `Tabs`/`TabsList`/`TabsTrigger`/`TabsContent`. `DollarSign` is no longer used since the value equation replaces the old 4-card stats grid.
  - `bun run lint` passes cleanly (0 errors, 0 warnings).
  - Pre-existing dev server error `Module not found: '@/components/views/legal-view'` is unrelated to this task (separate Phase 2 task).
  - Work record: `agent-ctx/2-c-full-stack-developer.md`.


## Task 2-e — Legal View + Profile InstaPay Banking Card (Agent: full-stack-developer)
- **NEW FILE** `src/components/views/legal-view.tsx` — legal documents viewer (resolves the pre-existing `Module not found: '@/components/views/legal-view'` error from tasks 2-a/2-b/2-c/2-d).
  - Header Card: "Legal" title with `Scale` icon in an emerald→amber gradient chip, subtitle "Terms & Conditions, Tax Compliance, and Privacy Policy", soft blurred emerald/amber glow in the top-right corner.
  - `Tabs` with 3 tabs (TabsList is `grid-cols-1 sm:grid-cols-3`):
    1. **Terms & Conditions** (type=`terms`) — `FileText` icon
    2. **Tax Compliance** (type=`tax`) — `Receipt` icon
    3. **Privacy Policy** (type=`privacy`) — `ShieldCheck` icon
    - Tab triggers show the full label on `sm+` and the first word on mobile.
  - State: `activeTab` (`LegalType = "terms" | "tax" | "privacy"`), `doc`, `loading`, `error`. `useEffect` re-fetches from `GET /api/legal?type={activeTab}` whenever the active tab changes (via `useCallback`-wrapped `fetchDoc` to satisfy exhaustive-deps).
  - Per-tab content:
    - Loading state: centered Card with an animated `Loader2` spinner + "Loading document…".
    - Error state: amber-tinted Card with a "Could not load document" message + the underlying error.
    - Empty state: muted Card when `document` is null or has no content sections.
    - Success state: title Card (large bold emerald title + amber "Last updated: DD Mon YYYY" badge with `Calendar` icon), then a stack of section Cards. Each section Card has a numbered emerald chip (1-based index) + bold heading, a `Separator`, and the body text in a `max-w-prose` block with `leading-7 text-muted-foreground whitespace-pre-line` for readability.
  - Helper `formatLegalDate(iso)` formats ISO date → "DD Mon YYYY".
  - Emerald + amber palette throughout; `cache: "no-store"` on the fetch. Uses shadcn Card, Badge, Tabs/TabsList/TabsTrigger/TabsContent, Separator + lucide icons (Scale, FileText, Receipt, ShieldCheck, Loader2, Calendar).
- **UPDATED** `src/components/views/profile-view.tsx` — added InstaPay Gini card to the Banking tab.
  - Added `Smartphone` to the lucide-react import list (Wallet/Download/ShieldCheck/Loader2 already imported).
  - Inserted a new `Card` titled "InstaPay Gini Account" (with `Smartphone` icon) BETWEEN the existing Roots Bank gradient card and the existing Subscription card. NFC Tag & VISA Card info card remains at the bottom unchanged.
  - Renders one of three states based on `m.instapayStatus`:
    - **VERIFIED**: green "VERIFIED" `Badge` (with `ShieldCheck`), "InstaPay Gini account linked" caption, and a 2-col grid showing `m.instapayAccountRef` (mono) and `m.instapayVerifiedAt` formatted via new `formatInstapayDate` helper ("DD Mon YYYY").
    - **PENDING**: amber "PENDING" `Badge` (with spinning `Loader2`), "Verification in progress" caption, an amber "Verify now" `Button` (triggers a sonner info toast placeholder), and conditionally shows `m.instapayAccountRef` if present.
    - **NONE** (or missing/empty status): muted "Not connected" `Badge`, "No InstaPay Gini account linked yet" caption, and an emerald "Connect InstaPay" `Button` (triggers a sonner info toast placeholder).
  - Below the status block: `Separator` + an emerald-tinted info box "About InstaPay Gini" containing the required note: "InstaPay Gini is used for subscription payments and KasiPool distributions. Download the app from Google Play or App Store."
  - Added a local `formatInstapayDate(iso)` helper (next to `InfoRow`) that formats ISO → "DD Mon YYYY".
  - Uses the existing `m` variable (`currentMember`) for all instapay fields; reads `m.instapayStatus`, `m.instapayAccountRef`, `m.instapayVerifiedAt` already defined on the `Member` interface in `src/lib/types.ts`.
  - Emerald + amber palette consistent with the rest of the Banking tab.
- `bun run lint` passes cleanly (0 errors, 0 warnings).
- Dev server log confirms `legal-view` module is now resolved and `GET /` returns 200 (the previous "Module not found" error from tasks 2-a..2-d is gone).
- Work record: `agent-ctx/2-e-full-stack-developer.md`.


## Task 4 — Shares View: Phase-aware values + Daily Profit Share (ZAR) (Agent: full-stack-developer)
- Updated `/home/z/my-project/src/lib/types.ts` `Share` interface with 3 optional (backwards-compatible) fields returned by the new `/api/shares` payload: `isLegacy?: boolean` (Phase 1 BOGO / FREE), `currentValuePerShare?: number` (current phase price), `currentTotalValue?: number` (quantity × currentValuePerShare).
- Updated `/home/z/my-project/src/components/views/shares-view.tsx`:
  - **`SharesData` interface**: replaced `dailyDividendPerShare`/`myDailyDividend` with `dailyProfitSharePerShare`/`myDailyProfitShare` (both ZAR); added `legacyShares: number`; updated `totalValue` comment to "sum of each share's quantity × its phase price" and `shareValuePerShare` comment to "default/legacy value".
  - **New helpers**: `fmtZAR` (`R X,XXX.XX`, `en-ZA`, 2dp) added next to existing `fmtUSD`. New computed `actualPurchaseValue = data.activeShares.reduce((s, x) => s + (x.totalAmount ?? 0), 0)` for the purchase-price "actual value" note.
  - **"Your shares" tile**: now renders `{data.totalShares} shares` as the big line; below it shows `({data.legacyShares} legacy shares FREE)` in amber when `legacyShares > 0`, else falls back to the `{kasiActiveCount} certificate(s)` count — matches the "20 shares (20 legacy shares FREE)" spec.
  - **"Total value" tile**: keeps `{fmtUSD(data.totalValue)}` (phase-based current value) as the big line; sub-line changed from "at current rate" to `(actual value {fmtUSD(actualPurchaseValue)})` showing the purchase price (sum of totalAmount) — matches the "$500 (actual value $1000)" spec.
  - **Daily profit share mini-row**: "Your daily dividend" → "Daily profit share", value now `fmtZAR(data.myDailyProfitShare)` (R, ZAR). "Per share / day" → "Per share" (removed "/day"), value now `fmtZAR(data.dailyProfitSharePerShare)` (R, ZAR). Shares-outstanding sub-line unchanged.
  - **Header subtitle**: "Daily dividends from KasiMall profits." → "Daily profit share from KasiMall & KasiMarketplace profits." (consistency with the rename + marketplace addition).
  - **Active KasiShare certificate cards**: 2×2 grid relabelled — "Price/share" → "Value/share" (`fmtUSD(s.currentValuePerShare ?? s.pricePerShare)`), "Total paid" → "Current value" (`fmtUSD(s.currentTotalValue ?? s.totalAmount)`). Added a "Legacy FREE" amber `Badge` (with Sparkles) next to the Award icon on cards where `s.isLegacy` is true, tying the card to the `legacyShares` count. Retracted (Revoked) cards and both Aureus active/retracted cards kept unchanged (historical purchase price stays correct for revoked records; print certificates still use purchase `pricePerShare`/`totalAmount`).
  - **"About KasiShares" bullet**: "Daily percentage of KasiMall profits shared equally between all sold shares." → "Daily percentage of KasiMall & KasiMarketplace profits shared equally between all sold shares."
  - **Kept all existing features intact**: Active/Retracted `Tabs`, Print certificate buttons (`printKasiCertificate`/`printAureusCertificate`), Buy KasiShares dialog (phase Select, quantity Input, BOGO breakdown, Confirm purchase), Share phases list with `Progress` bars + Phase 1 BOGO badge + Buy buttons, Aureus Shares section with equation row, Framer Motion animations, emerald + amber palette. All imports unchanged (kept `DollarSign` import per "keep existing imports" instruction).
  - `bun run lint` passes cleanly (0 errors, 0 warnings). `grep` confirms no remaining `dailyDividend`/`myDailyDividend`/`/ day`/`/day`/`Daily dividend`/`KasiMall profits` references in the file.
  - Dev server recompiles cleanly after edits (`✓ Compiled` with no shares-view errors); pre-existing `vouchers-view`/`refer-view` "Module not found" errors in dev.log are unrelated to this task (separate views).
  - Work record: `agent-ctx/4-full-stack-developer.md`.

## Task admin-update — Admin views: marketplace free-price + shares phase-based value & daily profit share

**Agent:** full-stack-developer
**Task ID:** admin-update
**Files touched:**
- `/home/z/my-project/src/components/admin/admin-marketplace.tsx`
- `/home/z/my-project/src/components/admin/admin-shares.tsx`
- `/home/z/my-project/worklog.md` (this summary)
- `/home/z/my-project/agent-ctx/admin-update-full-stack-developer.md` (work record)

### Context
The member-facing Shares view (`shares-view.tsx`, see task 4) and the marketplace backend were updated. The `/api/admin/marketplace` response now carries per-product `freePrice` + `freePriceDelta`, top-level `freeMemberOrders`/`paidMemberOrders`, per-category `freeOrders`/`paidOrders`, and per-order `pricingTier`. The member Shares view was renamed from "Daily dividend" (USD) to "Daily profit share" (ZAR) with a ~R37,000 pool, and legacy Phase-1 BOGO shares are shown as FREE. The two admin views had to be brought in line with these changes.

### `src/components/admin/admin-marketplace.tsx`
- Extended `Product` interface with `freePrice: number` + `freePriceDelta: number`. Extended `Order` interface with `pricingTier: "PAID" | "FREE"`. Added a new `CategoryStat` interface with `freeOrders`/`paidOrders`.
- Extended `totals` state to include `freeMemberOrders` and `paidMemberOrders` (with `?? 0` fallbacks for safety).
- **Stats grid**: expanded from `sm:grid-cols-4` to a responsive `sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6` grid. Added two new cards — "Paid member orders" (emerald ring, `Crown` icon) and "Free member orders" (amber ring, `Sparkles` icon) — both showing counts pulled from the new API fields.
- **Category revenue grid**: each cell now also shows `paidOrders`/`freeOrders` counts via small emerald/amber outline badges below a `Separator`, alongside the existing revenue / commission / order count.
- **Products table**: renamed "Price" header → "Member price" and inserted a new "Free price" column between member price and commission. The free-price cell renders `fmt(p.freePrice)` in amber with a `+N%` delta badge (using `p.freePriceDelta`); if `freePrice` is 0 or equals `price`, it shows a muted "Same" label instead.
- **Recent orders card**: header now shows two summary badges (paid / free counts). Each order row gets a PAID (emerald) or FREE (amber) outline badge inline with the product name, driven by `o.pricingTier`.
- **Edit/Create dialog**: added a "Free member price (R)" `Input` (paired with the existing "Price (R)" field in a 2-col grid) with the spec's note "Price for free members (usually 15% higher than member price)" below it. The existing helper text "Base price for paid members." was added under the price field. When both prices are set and differ, an amber info box appears: "Free members pay **R X.XX** — that's **N%** more than paid members (R Y.YY)."
- **`EMPTY_PRODUCT`** now seeds `freePrice: 0` so new products start with an empty (not undefined) free-price field.
- **Save**: the existing POST/PATCH body already spreads `editing` into the request, so `freePrice` is sent automatically. (The API route already accepts `freePrice` and defaults it to `price × 1.15` when omitted on POST.)
- **Imports**: added `Crown` and `Sparkles` from lucide-react. Removed the now-unused `motion` import from framer-motion that was in the original file (the original imported it but never used it — eslint would flag this).

### `src/components/admin/admin-shares.tsx`
- Added module-level constant `DAILY_PROFIT_POOL_ZAR = 37000` to centralize the ~R37,000/day profit pool assumption.
- Added `fmtZAR` helper next to the existing `fmtUSD`.
- **Stats grid**: expanded from 3 cards to 4 (responsive `sm:grid-cols-2 lg:grid-cols-4`). Kept "Active shares outstanding" and "Total value sold (purchase)" (`fmtUSD`). Added a new "Current value (phase-based)" card (emerald ring) showing `sum(activeShares → qty × phasePrice)` formatted in USD, with sub-line "sum of qty × phase price". Added a new "Daily profit share / share" card (amber ring, `Sparkles` icon) showing `R 37,000 / totalActiveShares` in ZAR with sub-line "R 37,000.00 pool / day".
- **Phase helper functions** added: `phasePriceFor(s)` (looks up the share's phase price in `phases`, falling back to `s.pricePerShare`) and `isLegacyShare(s)` (true when `s.phase === 1` and the Phase 1 entry has `bonusBuyOneGet === true`). Also added `phase1IsLegacy` derived boolean.
- **All certificates table**: added two new columns — "Phase price" (`fmtUSD(phasePriceFor(s))`) and "Current value" (`fmtUSD(s.quantity × phasePriceFor(s))`, emerald, font-semibold). The Phase cell now includes an amber "Legacy" outline badge (with `Sparkles` icon) for certificates where `isLegacyShare(s)` is true. The Status badge uses emerald for ACTIVE and rose for non-active statuses (e.g. RETRACTED) so retracted certs remain visible with distinct styling.
- **All certificates footer**: added a `tfoot` row that aggregates the active certificates' phase-based totals — `qty × phase price` label, total active shares count, and a bold emerald total `fmtUSD(totalPhaseValue)`. This satisfies "Total value should reflect phase-based pricing, not just totalAmount".
- **Profit share history card**: header renamed from "Dividend history" → "Profit share history". Each historical dividend card now renders `fmtZAR(d.amount)` as the headline amount and `fmtZAR(d.perShareAmount)` for the per-share line (was USD). Empty-state copy changed to "No profit shares declared yet."
- **Declare dialog**: header title "Declare dividend" → "Declare daily profit share". Label changed from "Total dividend amount (USD)" → "Total profit share amount (ZAR)". Default amount changed from `"50000"` → `"37000"`. Helper text now mentions "The daily profit pool is approximately R 37,000.00." Per-share row uses `fmtZAR`. The success toast on the client now formats as `R X.XXXX/share` (was `$X.XXXX/share`). The distribution info note ("immediately distributed ... DIVIDEND transaction, paid to their Roots Bank accounts") was kept verbatim.
- **Phase edit dialog**: kept all existing fields (price, total shares, status, BOGO switch). Updated the BOGO switch sub-text from "Phase 1 bonus special" to "Phase 1 bonus special (legacy FREE shares)" to reflect the new legacy framing.
- **Imports**: added `Sparkles` to the lucide-react import list. Removed the unused `motion` (framer-motion) and `Plus` imports that the original file declared but never used (these would have been flagged by eslint).

### Cross-cutting
- Both files keep the `"use client"` directive.
- Emerald + amber palette throughout (no indigo/blue).
- shadcn/ui `Card`/`Badge`/`Button`/`Input`/`Label`/`Separator`/`Switch`/`Dialog`/`Select`/`AlertDialog`/`Textarea` reused.
- Currency: `R` (ZAR) for marketplace prices, free-vs-paid deltas, daily profit share, and historical dividend display. `$` (USD) for share phase prices and phase-based/current values (shares are still priced in USD, only the daily profit share is in ZAR — matches spec).
- All existing features preserved: product search + edit/create dialog with color picker + delete confirm; phase editing + declare dialog + dividend history; active/retracted certificate rendering with status-coloured badges.

### Verification
- `bun run lint` → clean (0 errors, 0 warnings). The unused `motion` import was proactively removed from both files because eslint would have flagged it.
- `tail -40 dev.log` → most recent lines show `✓ Compiled in NNNms` and successful `GET /api/admin/stats 200` responses after the edits. The pre-existing "Module not found" for `admin-notifications` (referenced by `admin-shell.tsx`) is unrelated to this task.
- Work record: `agent-ctx/admin-update-full-stack-developer.md`.
