# Task 2-e — Legal View + Profile InstaPay Banking Card

**Agent:** full-stack-developer
**Date:** Phase 2 rework
**Scope:** NEW `src/components/views/legal-view.tsx` + UPDATE `src/components/views/profile-view.tsx` Banking tab.

## Context
- Read `worklog.md` for prior context (Tasks 2-a/2-b/2-c/2-d all noted the pre-existing `Module not found: '@/components/views/legal-view'` error blocking `app-shell.tsx`).
- Read `src/components/views/profile-view.tsx` and `src/lib/types.ts` to confirm `Member.instapayStatus / instapayAccountRef / instapayVerifiedAt` fields already exist (added by Task 2-d).

## Part 1 — Legal View (NEW FILE)

File: `src/components/views/legal-view.tsx`

### Implementation
- `"use client"` component, default + named export `LegalView`.
- **Header Card**: "Legal" title with `Scale` lucide icon in an emerald→amber gradient chip, subtitle "Terms & Conditions, Tax Compliance, and Privacy Policy". Soft blurred emerald/amber glow in the top-right corner (matches the dashboard/profile aesthetic).
- **Tabs**: shadcn `Tabs` controlled by `activeTab` state (`LegalType = "terms" | "tax" | "privacy"`). `TabsList` is `grid-cols-1 sm:grid-cols-3`. Triggers show the full label on `sm+` and the first word on mobile.
  1. **Terms & Conditions** (type=`terms`) — `FileText` icon
  2. **Tax Compliance** (type=`tax`) — `Receipt` icon
  3. **Privacy Policy** (type=`privacy`) — `ShieldCheck` icon
- **Fetch logic**: `useCallback`-wrapped `fetchDoc(type)` issues `GET /api/legal?type={type}` with `cache: "no-store"`. A `useEffect` re-runs `fetchDoc(activeTab)` whenever the active tab changes (satisfies exhaustive-deps cleanly). Response shape: `{ document: { title, lastUpdated, content: [{ heading, body }] } }`.
- **Per-tab render states**:
  - Loading → centered Card with animated `Loader2` spinner + "Loading document…".
  - Error → amber-tinted Card: "Could not load document" + the underlying error message.
  - Empty → muted Card when `document` is null or has no sections.
  - Success →
    - Title Card: large bold emerald title (`text-emerald-700 dark:text-emerald-400`) + amber "Last updated: DD Mon YYYY" `Badge` (with `Calendar` icon).
    - Section stack: each `content[]` item renders as its own `Card p-5 sm:p-6` with a numbered emerald chip (1-based idx) + bold heading, a `Separator`, then body text in a `max-w-prose` block styled `text-sm leading-7 text-muted-foreground whitespace-pre-line` for readable prose-like layout.
- **Helper**: `formatLegalDate(iso)` → "DD Mon YYYY" (e.g. "03 Apr 2025").
- **Imports used**: shadcn `Card`, `Badge`, `Separator`, `Tabs/TabsList/TabsTrigger/TabsContent`; lucide `Scale, FileText, Receipt, ShieldCheck, Loader2, Calendar`. Emerald + amber palette throughout.

### Result
- Resolves the long-standing `Module not found: '@/components/views/legal-view'` error reported by Tasks 2-a/2-b/2-c/2-d. Dev server log now shows `✓ Compiled` and `GET / 200`.

## Part 2 — Profile Banking Tab Update

File: `src/components/views/profile-view.tsx`

### Implementation
- Added `Smartphone` to the lucide-react import list (`Wallet`, `ShieldCheck`, `Loader2`, `Download` already imported).
- Inserted a new `Card` titled **"InstaPay Gini Account"** (with `Smartphone` icon) BETWEEN the existing Roots Bank gradient card and the existing Subscription card. NFC Tag & VISA Card info card remains at the bottom unchanged.
- Renders one of three states based on `m.instapayStatus` (using the existing `m = currentMember` variable):
  - **VERIFIED** → green "VERIFIED" `Badge` (with `ShieldCheck`), "InstaPay Gini account linked" caption, and a 2-col grid showing `m.instapayAccountRef` (mono) and `m.instapayVerifiedAt` formatted via the new `formatInstapayDate` helper ("DD Mon YYYY").
  - **PENDING** → amber "PENDING" `Badge` (with spinning `Loader2`), "Verification in progress" caption, an amber "Verify now" `Button` (triggers a sonner `info` toast placeholder), and conditionally shows `m.instapayAccountRef` if present.
  - **NONE** (or missing/empty status) → muted "Not connected" `Badge`, "No InstaPay Gini account linked yet" caption, and an emerald "Connect InstaPay" `Button` (triggers a sonner `info` toast placeholder).
- Below the status block: `Separator` + an emerald-tinted info box "About InstaPay Gini" containing the required note verbatim: "InstaPay Gini is used for subscription payments and KasiPool distributions. Download the app from Google Play or App Store."
- Added a local `formatInstapayDate(iso)` helper (placed next to `InfoRow`) that formats ISO → "DD Mon YYYY".
- Reads `m.instapayStatus`, `m.instapayAccountRef`, `m.instapayVerifiedAt` already defined on the `Member` interface in `src/lib/types.ts` (no type changes needed).
- Emerald + amber palette consistent with the rest of the Banking tab.

## Verification
- `bun run lint` → 0 errors, 0 warnings.
- `dev.log` tail confirms `legal-view` module is now resolved and `GET /` returns 200 (the previous "Module not found" error from tasks 2-a..2-d is gone).

## Files touched
- NEW: `src/components/views/legal-view.tsx`
- MODIFIED: `src/components/views/profile-view.tsx` (added Smartphone import, InstaPay card in Banking tab, formatInstapayDate helper)
- APPENDED: `worklog.md` (Task 2-e entry)
