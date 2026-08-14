# Presale staging test readiness

Author: Klaasvaakie ( |╲ )

## Purpose

This runbook verifies the private share-presale path in staging without changing production or treating a submitted transaction hash as payment.

## Safety boundary

- Use staging accounts, a staging campaign, and a staging-only invitation.
- Confirm the staging frontend points to the Encore staging backend.
- Do not use production credentials, production campaigns, or the production share ledger.
- Keep the campaign paused until the approved staging receiving route, token contract, network, and confirmation threshold have been checked by two operators.
- Use only the smallest approved test transfer. A typed or submitted hash is never proof of payment.
- Do not run incorporation until central payment settlement is visible and the expected allocation has been independently checked.

## Readiness gates

All gates must be green before funds move:

1. GitHub quality gates pass for the deployed commit.
2. Encore staging deployment completes and `/routing/registration` returns the international USDT policy.
3. Staging contains an active, approved receiving configuration for the selected network.
4. The test buyer has an authenticated international profile with completed KYC.
5. The campaign is isolated from production and has a deliberately small test allocation.
6. The operator has recorded the starting campaign totals: total, reserved, and sold shares.
7. A rollback owner and a second verifier are present.

## End-to-end test

1. Create a staging-only campaign and invitation while the campaign is paused.
2. Confirm the public offer does not expose a payment address before reservation.
3. Activate the staging campaign and reserve a small quantity with the invited test buyer.
4. Confirm the order receives its payment address, token, amount, expiry, network, and confirmation requirement from the central payment intent.
5. Submit an invalid or wrong-destination hash first. Confirm it cannot settle or allocate shares and that a rejected order releases its reservation once.
6. Create a fresh order and send the smallest approved USDT test transfer to the exact locked receiving address on the exact network.
7. Submit the transaction hash. Confirm the order remains pending until canonical chain evidence reaches the required confirmations.
8. Confirm one payment obligation and one intent become settled, once only.
9. Confirm campaign inventory moves from reserved to sold exactly once, including the configured bonus allocation.
10. Retry the proof submission. Confirm payment, sold inventory, and allocation totals do not change again.
11. Prepare incorporation. Confirm only the settled order appears and that preparation itself does not issue duplicate shares.
12. Apply incorporation once, then retry it. Confirm one share allocation and one certificate reference exist for the presale order.

## Failure tests

- Unknown, malformed, reused, wrong-network, wrong-token, wrong-recipient, reverted, underpaid, and low-confirmation transactions must not settle.
- A chain-provider outage must leave the payment retryable and must not release or sell shares.
- An expired intent must reject new proof without silently changing campaign totals.
- Concurrent proof retries must produce one settlement event and one inventory movement.
- A settled payment whose presale fulfilment is interrupted must complete safely when retried.

## Evidence to retain

- Deployed Git commit and GitHub workflow URLs.
- Encore staging deployment result and health/policy response.
- Staging campaign, invitation, order, obligation, intent, and attempt identifiers.
- Transaction hash and canonical explorer evidence for the approved test transfer.
- Before-and-after reserved, sold, incorporated, and certificate totals.
- Browser screenshots and console/network results for the buyer and administrator flows.
- Final tester, second verifier, date, outcome, and any defects.

## Exit decision

Staging is ready for a limited pilot only when every readiness gate and end-to-end step passes with retained evidence. Any mismatch in payment state, inventory, incorporation, authentication, or environment routing is a stop condition. Production activation remains a separate, explicit decision.
