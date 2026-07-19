-- Author: Klaasvaakie ( |╲ )
-- Legacy subscriptions used PAID as both the payment and entitlement state.
-- Preserve the payment evidence while normalizing the entitlement to ACTIVE.
UPDATE subscriptions subscription
SET status = 'active'
WHERE subscription.status = 'paid'
  AND EXISTS (
    SELECT 1
    FROM payments payment
    WHERE payment.subscription_id = subscription.id
      AND payment.status = 'paid'
  );
