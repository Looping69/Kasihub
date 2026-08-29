-- Author: Klaasvaakie ( |╲ )
-- Authoritative distinctive-number and phase certificate sequences.
CREATE TABLE share_lot_sequence (
  singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
  next_share_number INT NOT NULL DEFAULT 1 CHECK (next_share_number BETWEEN 1 AND 1200001)
);

INSERT INTO share_lot_sequence (singleton, next_share_number)
VALUES (TRUE, 1)
ON CONFLICT (singleton) DO NOTHING;

CREATE TABLE share_certificate_phase_sequences (
  phase_number INT PRIMARY KEY,
  next_certificate_number INT NOT NULL DEFAULT 1 CHECK (next_certificate_number > 0)
);

ALTER TABLE share_certificates
  ADD COLUMN phase_number INT,
  ADD COLUMN distinctive_from INT,
  ADD COLUMN distinctive_to INT,
  ADD COLUMN paid_shares INT,
  ADD COLUMN bonus_shares INT,
  ADD CONSTRAINT share_certificates_distinctive_range_check CHECK (
    (distinctive_from IS NULL AND distinctive_to IS NULL)
    OR (distinctive_from BETWEEN 1 AND 1200000 AND distinctive_to BETWEEN distinctive_from AND 1200000)
  ),
  ADD CONSTRAINT share_certificates_allocation_check CHECK (
    (paid_shares IS NULL AND bonus_shares IS NULL)
    OR (paid_shares > 0 AND bonus_shares >= 0 AND paid_shares + bonus_shares = total_shares)
  );

ALTER TABLE share_certificates
  ADD CONSTRAINT share_certificates_distinctive_ranges_do_not_overlap
  EXCLUDE USING gist (int4range(distinctive_from, distinctive_to, '[]') WITH &&)
  WHERE (distinctive_from IS NOT NULL);
