# Task 2-c — Shares View Rewrite (Agent: full-stack-developer)

## Summary
Rewrote `/home/z/my-project/src/components/views/shares-view.tsx` to match the updated `/api/shares` response shape and added the four new features required by the task: share value at $39.95/share, print certificate button, Active/Retracted tabs, and a dedicated Aureus Shares section.

## Files touched
1. `src/lib/types.ts` — added `AureusShare` interface.
2. `src/components/views/shares-view.tsx` — full rewrite.
3. `worklog.md` — appended Task 2-c record (this file is the agent-ctx record).

## Changes made

### types.ts
Added `AureusShare` interface matching the Prisma `AureusShare` model (id, phase, pricePerShare, quantity, totalAmount, certificateNo, prevCertificateNo, status, createdAt) so the view can be strictly typed.

### shares-view.tsx — full rewrite

**New SharesData interface** (matches new API):
```ts
interface SharesData {
  phases: SharePhase[];
  activeShares: Share[];
  retractedShares: Share[];
  aureusShares: AureusShare[];
  retractedAureusShares: AureusShare[];
  totalShares: number;
  totalValue: number;            // = totalShares × shareValuePerShare
  shareValuePerShare: number;    // 39.95
  aureusValuePerShare: number;   // 15.00
  aureusTotalShares: number;
  aureusTotalValue: number;
  dailyDividendPerShare: number;
  myDailyDividend: number;
  totalSharesOutstanding: number;
}
```

#### 1. KasiShare value equation card (NEW top stats area)
A single gradient Card replaces the old 4-card stats grid. It lays out the value equation visually:

```
[Your shares]  ×  [Share value]  =  [Total value]
   N              $39.95              $X,XXX.XX
                  / share
```

- Left tile: `totalShares` + certificate count.
- Middle tile: `fmtUSD(data.shareValuePerShare)` ($39.95) — current value, NOT purchase price.
- Right tile: `fmtUSD(data.totalValue)` = totalShares × shareValuePerShare.
- Below: 2-column mini-row with `myDailyDividend` (emerald) and `dailyDividendPerShare` + `totalSharesOutstanding`.

#### 2. Aureus Shares section (NEW)
A parallel gradient Card (orange/amber palette, `Gem` icon) with the same equation layout for Aureus:
```
[aureusTotalShares]  ×  [aureusValuePerShare $15.00]  =  [aureusTotalValue]
```

#### 3. Print certificate buttons (NEW)
- Every active KasiShare certificate card has an amber-outline Print button (`Printer` icon).
- Every active Aureus certificate card has an orange-outline Print button.
- `printKasiCertificate(share, memberName)` and `printAureusCertificate(share, memberName)` open a new window with full standalone HTML and call `window.print()` on load.
- Printable certificate template includes:
  - Decorative double border (emerald for KasiShare, amber/brown for Aureus) + CSS corner ornaments + inner accent border.
  - Gold radial-gradient "OFFICIAL SEAL" / "AUREUS SEAL" badge.
  - "Solidus Holdings (Pty) Ltd" brand header + "KaSiHUB Share Certificate" / "Aureus Share Certificate" H1 + subtitle.
  - "This is to certify that" intro + large member name (derived from `useKasiStore().currentMember`).
  - 2-column grid of fields: Certificate No., Phase, Number of Shares, Price per Share, Total Amount, Date Issued.
  - Footer with "Solidus Holdings (Pty) Ltd" + legal disclaimer.
  - `@media print` rule to flatten background and remove box-shadow.
- If pop-ups are blocked, sonner `toast.error` is shown.

#### 4. Tabs — Active vs Retracted (NEW)
shadcn `Tabs` with 2 `TabsTrigger`s:
- **Active** (default, emerald-tinted, count badge): shows `activeShares` (KasiShare cards, amber gradient, with Print buttons) followed by `aureusShares` (orange gradient, with Print buttons). Empty state when both lists are empty.
- **Retracted** (rose-tinted, count badge): shows `retractedShares` (REVOKED KasiShare, dashed border, muted bg, line-through on cert no/title/phase/quantity, rose "Revoked" badge, opacity-70) followed by `retractedAureusShares` (RETRACTED Aureus, same muted style, rose "Retracted" badge). No Print buttons on retracted cards. Empty state when both lists are empty.

#### 5. Kept as-is
- KasiShare phases list with `Progress` bars + Phase 1 BOGO badge + Buy buttons (untouched).
- Buy KasiShares dialog (Select phase, quantity, BOGO breakdown, Confirm purchase) — unchanged logic; only the source data changed from `data.shares` to `data.activeShares`.
- "About KasiShares" info card with green-check bullets — untouched.
- Framer Motion fade/scale animations on cards and phases — preserved.
- Emerald + amber palette throughout; new orange accent for Aureus.
- `fmtUSD` uses `en-US` with 2 dp for all share values.

## Imports
- Removed: `ArrowUpRight`, `DollarSign` (no longer used).
- Added: `Gem`, `Printer` from lucide-react; `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` from shadcn; `AureusShare`, `Member` from types.

## Lint / Build
- `bun run lint` passes cleanly (0 errors, 0 warnings).
- Pre-existing dev server error `Module not found: '@/components/views/legal-view'` is unrelated to this task (separate Phase 2 task).
