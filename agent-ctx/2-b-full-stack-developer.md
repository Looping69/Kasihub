# Task 2-b — Eco-System View Rewrite (Agent: full-stack-developer)

## Summary
Rewrote `/home/z/my-project/src/components/views/ecosystem-view.tsx` to apply the Phase 2 Eco-System rework: rename "Forced matrix" → "Eco-System", apply distinct level colors (emerald/teal/amber/orange/rose/violet), remove upline block, remove "No recruitment required" elements, add 3 daily/weekly/monthly earnings cards, remove the 25% tax sentence, and keep + colorize the tree visualization.

## Changes
1. **Header**: "5 × 6 Forced Ecosystem" → "5 × 6 Eco-System". Subtitle now reads "…The 5×6 structure fills top-left to bottom-right — spillover from upline fills your Eco-System downline." (no "no recruitment" text).
2. **3 new earnings cards** above the stats strip:
   - Daily Earnings — emerald, Wallet icon, "Today" — `earningsToday`
   - Weekly Earnings — amber, Calendar icon, "Mon – Sun" — `earningsThisWeek`
   - Monthly Earnings — teal, TrendingUp icon, "1st – last day" — `earningsThisMonth`
   - Fetched in parallel with matrix via `Promise.all` from `/api/dashboard?memberId=...`. Format: `R X,XXX.XX` (en-ZA, 2 dp).
3. **Stats strip**: "Your downline" → "Eco-System downline". Removed "Upline chain" stat and replaced with "Total spots" (19,530). Kept monthly commission (emerald) and "Levels filled X / 6".
4. **Removed the entire "Your upline" card**. No upline shown anywhere.
5. **Level breakdown**:
   - Removed the green "No recruit required" badge.
   - Each row uses its distinct level color (badge gradient, percent text, active background+ring, progress fill).
   - Custom div progress bar (replaced shadcn `Progress`) so the fill uses the exact level oklch color via inline style.
6. **Tree visualization**:
   - "Matrix tree" → "Eco-System tree".
   - Legend expanded to show all 6 level colors + "You" + "Open spot".
   - Each non-me node tinted with 12% opacity overlay of its level color, plus level-colored border and hover border.
   - "You" node keeps emerald→amber gradient.
   - Empty spots use level-color dashed border.
   - Tooltip includes "Level X · {colorName}".
7. **Info card**:
   - "How the 5 × 6 matrix works" → "How the 5 × 6 Eco-System works".
   - All "matrix" → "Eco-System" in bullets.
   - Removed the 25% tax / IRP5 bullet entirely.
   - Changed "No recruitment is required to earn from the matrix. Spillover from upline fills your downline." → just "Spillover from upline fills your downline.".

## Color mapping
`LEVEL_COLORS` array (idx 0–5) holds emerald, teal, amber, orange, rose, violet.
`colorForLevel(level) = LEVEL_COLORS[max(0, min(5, level-1))]` — so tree levels 0 and 1 both map to emerald (idx 0), level 2 → teal (idx 1), etc. Table levels 1–6 map directly to indices 0–5.

Each `LevelColor` has:
- `name`, `text`, `textStrong`, `bg`, `gradientFrom`, `gradientTo`, `border`, `hoverBorder`, `softBg`, `ring`, `swatch` (all Tailwind class strings, statically present so Tailwind v4 picks them up)
- `oklch` (raw value for inline styles, e.g. progress fill + tree node tint overlay)

## Technical notes
- "use client"
- Uses `useKasiStore` (`currentMember`)
- Uses shadcn/ui `Card`, `Tooltip*`
- Framer Motion for card fade-in and progress bar width animation
- lucide-react icons: Network, Users, Loader2, Info, UserCircle2, Building2, User, Crown, Wallet, Calendar, TrendingUp, GitFork
- Parallel fetches `/api/matrix` + `/api/dashboard` on mount
- `MatrixData` interface still includes `upline` (API returns it) but it is never rendered
- Removed unused imports: Badge, Button, Separator, ChevronUp, GitBranch

## Lint
`bun run lint` passes cleanly (0 errors, 0 warnings).

## Pre-existing (NOT my task)
Dev server still logs `Module not found: '@/components/views/legal-view'` — unrelated to this task (separate Phase 2 task).
