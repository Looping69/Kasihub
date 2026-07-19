-- Author: Klaasvaakie ( |╲ )
CREATE TABLE share_inventory_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_id UUID NOT NULL REFERENCES share_phases(id),
  quantity INT NOT NULL CHECK (quantity > 0),
  reason TEXT NOT NULL,
  source_reference TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (phase_id, source_reference)
);

-- Link imported active holdings to their imported certificate evidence.
UPDATE share_purchases purchase
SET certificate_id = certificate.id
FROM share_certificates certificate
WHERE purchase.certificate_id IS NULL
  AND purchase.status = 'active'
  AND certificate.profile_id = purchase.profile_id
  AND certificate.total_shares = purchase.quantity + purchase.bonus_quantity
  AND certificate.issued_at = purchase.created_at;

-- The legacy phase counter includes historical allocations for which the source
-- database has no recipient-level purchase rows. Record that opening difference
-- explicitly instead of manufacturing owners or silently increasing inventory.
INSERT INTO share_inventory_adjustments (phase_id, quantity, reason, source_reference)
SELECT phase.id,
       phase.total_quantity - phase.quantity_available
         - COALESCE(SUM(CASE WHEN purchase.status IN ('active', 'reserved', 'paid')
             THEN purchase.quantity + purchase.bonus_quantity ELSE 0 END), 0),
       'Legacy opening allocation without recipient-level purchase evidence',
       'legacy-opening-allocation'
FROM share_phases phase
LEFT JOIN share_purchases purchase ON purchase.phase_id = phase.id
GROUP BY phase.id, phase.total_quantity, phase.quantity_available
HAVING phase.total_quantity - phase.quantity_available
         - COALESCE(SUM(CASE WHEN purchase.status IN ('active', 'reserved', 'paid')
             THEN purchase.quantity + purchase.bonus_quantity ELSE 0 END), 0) > 0
ON CONFLICT (phase_id, source_reference) DO NOTHING;

CREATE INDEX idx_share_inventory_adjustments_phase
  ON share_inventory_adjustments(phase_id);
