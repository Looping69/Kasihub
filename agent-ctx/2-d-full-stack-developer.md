# Task 2-d — Registration Wizard Rewrite (Agent: full-stack-developer)

## Summary
Completely rewrote `/home/z/my-project/src/components/registration-wizard.tsx` to implement the new 5-step registration flow with conditional InstaPay step, citizenship-based pricing, and updated review/done steps. Extended `src/lib/types.ts` with `CitizenshipType` and additional `MembershipType` values.

## Files modified
- `src/lib/types.ts` — added `CitizenshipType` union (8 values); extended `MembershipType` with `SOLE_PROPRIETOR`, `NPO_NGO`, `FREE` (backwards-compatible additions only).
- `src/components/registration-wizard.tsx` — full rewrite.

## New step flow
1. **Citizenship** — 8 radio-card options in 2-col grid + upline input (debounced lookup via `/api/admin/members`) + confirmation checkbox (text adapts to upline presence). Continue disabled until citizenship selected AND checkbox ticked.
2. **InstaPay** (ONLY for `SA_CITIZEN_SA` and `SA_NPO_NGO` — others skip via `getSteps()`) — Download option (fetches Android/iOS URLs from `/api/instapay/status`) or Verify existing account (5 identifier fields, simulated verification client-side per task spec, accepts 6+ chars).
3. **Membership & Subscription** — SA members see ZAR pricing (R140/R300/R250/R0), international members see USD pricing ($30/$30/$50/$0). Payment method card: "InstaPay Gini" (SA) or "Bankus Platform" (intl). Removed all Bank/Card/Cash options and the Solidus Holdings card.
4. **Details** — Adaptive fields: company (name+reg), NPO (org name + NPO no), sole prop (business name + personal ID), individual (first/last + ID/Passport, SARS for SA only). Common: email, mobile, country (with intl options), city, postal code, address, beneficiary.
5. **Review & Confirm** — Summary card with all data; removed NFC/VISA mentions; "Eco-System" not "matrix"; replaced "next open spot" sentence with "Your profile will be created and you'll get access to the KaSiHUB UI." Re-displays upline confirmation tick.
6. **Done** — Spring-animated success badge, profile number, "Enter the Eco-System" button.

## Key implementation details
- Dialog width: `w-[90vw] max-w-[1100px]`.
- Dynamic steps: `getSteps(citizenshipType)` returns steps array; InstaPay step only included when citizenship ∈ `{SA_CITIZEN_SA, SA_NPO_NGO}`. next()/prev() walk the dynamic array.
- `setCitizenship()` resets dependent fields (membershipType, InstaPay state, country default).
- `canProceed(step, data)` gates the Continue button per-step (citizenship+checkbox / InstaPay verified or download / membershipType selected / required detail fields).
- Submit payload sent to `POST /api/members` includes all new fields: `citizenshipType`, `membershipType`, `uplineProfileNumber`, `uplineConfirmed`, `instapayStatus`, `instapayAccountRef`, `instapayVerifiedAt`. Company/NPO/SoleProp/Individual branches populate the appropriate fields.
- Components used: shadcn Dialog, Button, Input, Label, RadioGroup, RadioGroupItem, Card, Badge, Checkbox, Separator, Textarea. Lucide icons. Framer Motion transitions. `useKasiStore` for closeRegistration/login. `toast` from sonner.
- Emerald + amber palette throughout. No indigo/blue.

## Verification
- `bun run lint` — passes cleanly (0 errors, 0 warnings).
- Pre-existing dev server error (`Module not found: '@/components/views/legal-view'`) is from a separate task and unrelated to this work.
