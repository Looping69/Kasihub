# Phone controls design QA

- Source visual truth: `phone-controls-source.png`
- Implementation screenshot: `phone-controls-inline-valid.png`
- Combined comparison: `phone-controls-comparison.png`
- Responsive evidence: `phone-controls-inline-mobile.png` and a full-page 390px browser capture
- Source pixels: 1887 x 825
- Implementation focused crop: 506 x 208 pixels at a 1440 x 1000 CSS viewport and device scale 1
- Mobile viewport: 390 x 844 CSS pixels at device scale 1
- State: South Africa selected; matching valid cellphone numbers; both validation ticks visible

## Full-view comparison evidence

The original four-field presentation wrapped both country-code labels and used excessive vertical space. The revised form presents two compact rows. Each row has one short label, followed by a 7.5rem country-code selector and a flexible number input. The same structure remains inline at the 390px mobile viewport without horizontal overflow.

## Focused-region comparison evidence

The combined comparison shows the reported region at readable scale. The selector and number input align on one baseline; both selectors show `ZA +27`; the primary number tick and matching-confirmation tick remain visible. No additional focused region was needed because this change is isolated to the two phone-control rows.

## Required fidelity surfaces

- Fonts and typography: existing application font, weight, and label sizing are preserved. Labels are shortened to prevent wrapping.
- Spacing and layout rhythm: four stacked field blocks are reduced to two compact rows with an 8px internal gap.
- Colors and visual tokens: existing borders, navy surfaces, focus ring, and emerald validation color are unchanged.
- Image quality and asset fidelity: no image assets are involved in this control change.
- Copy and content: `Cellphone *` and `Confirm cellphone *` replace the verbose labels; the validation guidance remains unchanged.

## Findings

No actionable P0, P1, or P2 mismatch remains. The local development diagnostics reported an unrelated `/api/theme` 503 because the local preview has no production BFF, but browser console inspection showed no client rendering errors and the diagnostics overlay is not present in production.

## Comparison history

- P2: country-code labels wrapped and doubled the vertical height of the phone section.
- Fix: consolidated each country selector and number field under one short row label.
- Post-fix evidence: `phone-controls-comparison.png` and the 390px responsive capture show both rows inline without overflow.

## Final result

final result: passed

---

# Crypto payment QR and verification design QA

- Source visual truth: `C:/Users/wimpi/AppData/Local/Temp/codex-clipboard-07a9c25e-c3a7-4e1f-b8fb-783ef88bb00f.png`
- Implemented route: `/presale` in the active crypto reservation state
- Responsive evidence: `kasishares-crypto-verification-pending-desktop-rehydrated.png` and `kasishares-crypto-verification-pending-mobile-rehydrated.png`
- Viewports: 1440 x 1000 desktop and 390 x 844 mobile
- State: BSC payment hash submitted; 1 of 3 required confirmations restored after a full reload

## Fidelity and product decisions

- Preserved the source hierarchy of network, verified receiving address, QR, amount, and safety guidance while applying the established KaSiShares visual system.
- Replaced the source's generic minimum-deposit treatment with the reservation's exact amount due. The BSC QR encodes the verified token contract, receiver, and reserved amount; the UI still tells the user to confirm every wallet field.
- Kept the copy control and added a four-stage visual verification tracker: exact transfer, hash submission, chain verification, and certificate readiness.
- Did not copy the source's `History` action because this journey already has an authoritative applicant account and reservation history surface.
- The wallet request is deliberately BSC/BEP20-only, matching the active presale payment policy; unsupported networks fail closed without rendering a QR.

## Findings and fixes

- P2: the first mobile action labels could clip. Fixed with compact responsive labels and verified at 390px.
- P2: the first desktop composition squeezed payment details and the QR into a narrow nested grid. Fixed by stacking them inside the reservation card.
- P1: after reloading, the authoritative journey remained pending but the local progress display lost the submitted hash and confirmation count. Fixed by hydrating the display order from the authenticated portal response.
- Final desktop and mobile captures show `Hash saved securely` and `1/3 confirmations` after reload, with document width equal to viewport width.

## Final result

final result: passed
