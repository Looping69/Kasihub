-- Author: Klaasvaakie ( |╲ )
CREATE TABLE subscription_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL,
  days_before INT NOT NULL CHECK (days_before IN (1, 3, 5)),
  billing_period TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'WHATSAPP',
  status TEXT NOT NULL DEFAULT 'QUEUED',
  message TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (profile_id, days_before, billing_period)
);

CREATE INDEX idx_subscription_notifications_profile ON subscription_notifications(profile_id, sent_at DESC);
