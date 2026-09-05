ALTER TABLE share_certificates ADD COLUMN complimentary_shares INT NOT NULL DEFAULT 0 CHECK (complimentary_shares >= 0);
ALTER TABLE share_purchases ADD COLUMN complimentary_quantity INT NOT NULL DEFAULT 0 CHECK (complimentary_quantity >= 0);
ALTER TABLE share_certificates DROP CONSTRAINT share_certificates_allocation_check;
ALTER TABLE share_certificates ADD CONSTRAINT share_certificates_allocation_check CHECK (
  (paid_shares IS NULL AND bonus_shares IS NULL AND complimentary_shares=0)
  OR (paid_shares > 0 AND bonus_shares >= 0 AND complimentary_shares=0 AND paid_shares+bonus_shares=total_shares)
  OR (paid_shares=0 AND bonus_shares=0 AND complimentary_shares=total_shares AND total_shares > 0)
);
ALTER TABLE share_purchases ADD CONSTRAINT share_purchase_complimentary_terms CHECK (
  complimentary_quantity=0 OR (quantity=0 AND bonus_quantity=0 AND total_amount=0 AND status='granted')
);
