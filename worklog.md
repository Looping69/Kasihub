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

