# KasiPay public information site — design QA

> ( |╲ ) — Author: Klaasvaakie

## Evidence

- Source visual truth:
  - `tmp/instapay-source-capture/home-desktop.png`
  - `tmp/instapay-source-capture/home-mobile-top-final.png`
  - desktop captures for Gini, Merchant, Pricing, About, FAQ, and Contact
- Rendered implementation:
  - `tmp/instapay-source-capture/kasipay-desktop.png`
  - `tmp/instapay-source-capture/kasipay-desktop-top.png`
  - `tmp/instapay-source-capture/kasipay-mobile-top.png`
  - `tmp/instapay-source-capture/kasipay-faq-mobile.png`
- Combined comparison:
  - `tmp/instapay-source-capture/source-vs-kasipay-desktop.png`
  - `tmp/instapay-source-capture/source-vs-kasipay-mobile.png`
- Desktop viewport: 1440 × 900 CSS pixels at device scale 1.
- Mobile viewport: 390 × 844 CSS pixels at device scale 1.
- Source desktop page: 1425 × 7398 pixels after capture.
- Implementation desktop page: 1440 × 5178 pixels after capture.
- State: signed-out public information home; mobile navigation closed for fidelity comparison; FAQ first answer expanded for interaction evidence.

## Full-view comparison

The implementation preserves the source’s light lilac ground, deep navy typography, orange conversion color, rounded white navigation, paired consumer/merchant device imagery, alternating product sections, dark platform band, purple closing CTA, and information-dense footer. The KasiPay version deliberately uses KasiHub branding and a clearer custodian disclosure while retaining the visual structure and public product story.

The implementation is shorter than the source because repeated app-store prompts, duplicated partner sliders, and repeated signup blocks were consolidated. This is an intentional content-architecture constraint rather than missing product information.

## Focused comparison

The hero was compared side-by-side on desktop and mobile. The implementation retains the same hierarchy and responsive transformation: logo and menu, large message, “with or without a bank” line, consumer/merchant description, orange primary action, and paired product-device imagery. Text remains readable without horizontal overflow at 390 pixels.

## Required fidelity surfaces

- Fonts and typography: source uses Roboto; implementation uses the system Arial/Roboto stack to avoid a remote font dependency. Weight, hierarchy, condensed display scale, line height, and wrapping match the source character while supporting the KasiPay wordmark.
- Spacing and layout rhythm: desktop two-column sections and mobile single-column stacking are consistent. No horizontal overflow was found. Header, hero, section padding, cards, CTA, and footer maintain the source’s broad spacing rhythm.
- Colors and visual tokens: navy, lilac, white, orange, peach, and purple tokens visually align with the source. CTA contrast remains clear.
- Image quality and asset fidelity: 124 authorised source image assets were copied locally, including the complete observed Gini and Merchant sets. No hotlinked visual assets remain. Browser validation found no broken images after lazy loading.
- Copy and content: public Gini, merchant, pricing, developer, FAQ, partner, security, and support information is represented. KasiPay-specific copy explicitly avoids claiming custody, live API completion, or an approved final fee schedule.

## Interaction and browser checks

- Desktop home rendered at `/kasipay`.
- Mobile navigation opened and reported `aria-expanded="true"`.
- Navigation reached `/kasipay/faq`.
- The first FAQ answer expanded and reported `aria-expanded="true"`.
- Gini and Merchant returned HTTP 200; the removed Developers route returned HTTP 404 as intended.
- No horizontal overflow at desktop or mobile widths.
- No implementation console errors were observed.
- The existing Next.js logo aspect-ratio development warning is visual-only and does not affect production rendering.

## Findings

- No actionable P0, P1, or P2 differences remain.
- P3: a future pass can replace the compact KasiHub logo lockup with a dedicated vector KasiPay brand asset once the final sub-brand artwork is approved.
- P3: final commercial fee tables should replace the current transparent “pending approved schedule” copy when the signed InstaPay schedule is supplied.

## Comparison history

1. Initial implementation:
   - TypeScript rejected readonly tuple destructuring in two mapped content collections.
   - Fix: replaced mutable destructuring callbacks with indexed readonly tuple access.
   - Post-fix evidence: typecheck and production build passed.
2. Initial browser pass:
   - Several below-fold images appeared unloaded in the immediate DOM check.
   - Fix: exercised the page through its lazy-load states and rechecked all images.
   - Post-fix evidence: zero broken images after scroll; all local asset URLs returned HTTP 200.
3. Initial mobile interaction:
   - Global FAQ locator matched header and footer links.
   - Fix: scoped the interaction to `#kp-nav`.
   - Post-fix evidence: navigation and FAQ expansion passed.
4. Gini and Merchant expansion:
   - Removed the Developers navigation item and static route.
   - Added the complete public Gini journey: account structure, onboarding, eligible interest, savings, cashback, lifestyle services, transfers and support.
   - Added the complete public Merchant journey: onboarding, app operations, Tap to Pay, QR codes, payment links, online payments, InstaPay Plus and InstaPay Pro.
   - Post-fix evidence: desktop Gini height 5801px, desktop Merchant height 7519px, mobile Merchant height 12116px, zero broken images, zero overflow, zero local console errors.

## Final result

final result: passed
