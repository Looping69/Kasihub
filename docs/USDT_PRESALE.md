# USDT Presale Operations

Author: Klaasvaakie `( |╲ )`

The presale is an invitation-only reservation and USDT settlement system. It
does not write into the live KaSiShares database and it does not issue final
share certificates. Its PostgreSQL resource is named `presale`.

## State boundary

`awaiting_payment -> payment_submitted -> payment_detected -> confirmed`

- The order reserves inventory atomically when it is created.
- A submitted transaction hash is evidence supplied by the buyer, not proof of
  payment.
- Only a correctly signed verifier event can mark the transaction detected or
  confirmed.
- The verifier event must match the configured network, USDT token contract,
  receiving address, amount and required confirmation depth.
- An unpaid reservation expires after the campaign payment window and releases
  both campaign and invitation inventory.
- Confirmed orders remain in the presale database until an administrator
  prepares an immutable incorporation manifest.

## Required activation inputs

Do not activate a campaign until all of these are known and verified:

1. the exact blockchain network;
2. the official USDT token contract on that network;
3. the controlled receiving address;
4. the required confirmation depth;
5. the number of shares and USDT price per share;
6. campaign start and end times;
7. the appointed blockchain monitoring provider; and
8. the Encore secret `PresaleWebhookSecret` shared only with that verifier.

Create or update a campaign through `POST /admin/presale/campaigns`. Create
private invitation links through `POST /admin/presale/invitations`. The raw
invitation token is returned once and is stored only as a SHA-256 hash.

The buyer route is `/presale?invite=<opaque invitation token>`. It intentionally
does not appear in public navigation.

## Verifier contract

The verifier posts JSON to `POST /presale/webhooks/usdt` and sends a lowercase
hex HMAC-SHA256 signature in `X-Presale-Signature`. The signed message is the
pipe-separated sequence below:

```text
eventId|provider|orderReference|lower(txHash)|lower(network)|lower(tokenContract)|lower(receiverAddress)|lower(senderAddress)|amountUsdt(6dp)|confirmations|blockNumber
```

Every provider event ID is deduplicated. A transaction hash can belong to only
one order, and an order can have only one payment transaction. A previously
detected transaction cannot be replaced by the buyer.

## Incorporation

`POST /admin/presale/incorporation-batches` locks all confirmed, unbatched
orders for a campaign and returns a deterministic manifest plus its SHA-256
hash. Each manifest row contains the presale order ID/reference, buyer identity,
quantity, paid USDT and confirmed transaction hash.

The future full-site importer must:

1. verify the manifest hash;
2. match the buyer to a verified KaSiHUB profile and completed KYC record;
3. use the presale order ID as the permanent idempotency key;
4. issue shares and certificates through the authoritative shares domain;
5. record the resulting purchase/certificate IDs back against the batch; and
6. reconcile quantities and payment evidence before marking the batch applied.

Never treat a redirect, screenshot, transaction-hash submission, internal
status, or unconfirmed chain event as settled payment.
