-- Author: Klaasvaakie ( |╲ )
CREATE TABLE presale_webpay_settlements (
  provider_reference TEXT PRIMARY KEY,
  order_id UUID NOT NULL UNIQUE REFERENCES presale_orders(id),
  request_token_id TEXT NOT NULL,
  amount_zar NUMERIC(12,2) NOT NULL CHECK (amount_zar > 0),
  payment_method TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
