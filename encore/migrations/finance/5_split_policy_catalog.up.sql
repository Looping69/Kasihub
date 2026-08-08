-- Author: Klaasvaakie ( |╲ )

-- Active/approved policy versions are immutable economic contracts. Rules may
-- only be edited while their parent policy is draft.
CREATE OR REPLACE FUNCTION reject_locked_split_rule_mutation()
RETURNS trigger AS $$
DECLARE
  parent_status TEXT;
  target_policy_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_policy_id := OLD.policy_id;
  ELSE
    target_policy_id := NEW.policy_id;
  END IF;

  SELECT status INTO parent_status FROM split_policies WHERE id = target_policy_id;
  IF parent_status IS DISTINCT FROM 'draft' THEN
    RAISE EXCEPTION 'split policy rules are immutable once policy leaves draft';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_split_policy_rules_locked
BEFORE UPDATE OR DELETE ON split_policy_rules
FOR EACH ROW EXECUTE FUNCTION reject_locked_split_rule_mutation();

CREATE OR REPLACE FUNCTION validate_split_policy_activation()
RETURNS trigger AS $$
DECLARE
  basis_total BIGINT;
  fixed_total BIGINT;
  percentage_rule_count BIGINT;
  fixed_rule_count BIGINT;
  remainder_rule_count BIGINT;
BEGIN
  IF NEW.status NOT IN ('approved', 'active') OR OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  IF NEW.approved_by IS NULL OR btrim(NEW.approved_by) = '' OR (NEW.approved_on IS NULL AND NEW.approved_at IS NULL) THEN
    RAISE EXCEPTION 'approved/active split policy requires approval provenance';
  END IF;

  SELECT
    COALESCE(SUM(basis_points), 0),
    COALESCE(SUM(fixed_amount_minor), 0),
    COUNT(*) FILTER (WHERE basis_points IS NOT NULL),
    COUNT(*) FILTER (WHERE fixed_amount_minor IS NOT NULL),
    COUNT(*) FILTER (WHERE rule_code = NEW.remainder_rule_code)
  INTO basis_total, fixed_total, percentage_rule_count, fixed_rule_count, remainder_rule_count
  FROM split_policy_rules
  WHERE policy_id = NEW.id;

  IF NEW.policy_kind = 'percentage' THEN
    IF percentage_rule_count = 0 OR fixed_rule_count <> 0 OR basis_total <> 10000 THEN
      RAISE EXCEPTION 'percentage split policy must contain only percentage rules totaling 10000 basis points';
    END IF;
    IF remainder_rule_count <> 1 THEN
      RAISE EXCEPTION 'percentage split policy requires exactly one configured remainder rule';
    END IF;
  ELSE
    IF fixed_rule_count = 0 OR percentage_rule_count <> 0 OR fixed_total <> NEW.expected_total_minor THEN
      RAISE EXCEPTION 'fixed split policy rules must equal expected_total_minor';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_split_policy_activation_guard
BEFORE UPDATE OF status ON split_policies
FOR EACH ROW EXECUTE FUNCTION validate_split_policy_activation();

CREATE OR REPLACE FUNCTION reject_locked_split_policy_economics()
RETURNS trigger AS $$
BEGIN
  IF OLD.status <> 'draft' AND (
    NEW.policy_key IS DISTINCT FROM OLD.policy_key OR
    NEW.version IS DISTINCT FROM OLD.version OR
    NEW.policy_kind IS DISTINCT FROM OLD.policy_kind OR
    NEW.currency IS DISTINCT FROM OLD.currency OR
    NEW.minor_unit_scale IS DISTINCT FROM OLD.minor_unit_scale OR
    NEW.expected_total_minor IS DISTINCT FROM OLD.expected_total_minor OR
    NEW.remainder_rule_code IS DISTINCT FROM OLD.remainder_rule_code OR
    NEW.source_reference IS DISTINCT FROM OLD.source_reference OR
    NEW.source_revision IS DISTINCT FROM OLD.source_revision OR
    NEW.approved_by IS DISTINCT FROM OLD.approved_by OR
    NEW.approved_on IS DISTINCT FROM OLD.approved_on OR
    NEW.approved_at IS DISTINCT FROM OLD.approved_at
  ) THEN
    RAISE EXCEPTION 'approved/active split policy economics and approval provenance are immutable; create a new version';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_split_policy_economics_locked
BEFORE UPDATE ON split_policies
FOR EACH ROW EXECUTE FUNCTION reject_locked_split_policy_economics();

-- Adult membership profit split v1. Approved business decision:
-- 59% Custodian, 1% Pioneer, 1% Private, 1% NPO, 38% Shareholders.
INSERT INTO split_policies
  (id, policy_key, version, policy_kind, status, currency, minor_unit_scale,
   remainder_rule_code, source_reference)
VALUES
  ('b4a4e970-8db6-4c53-90fb-1e9eafcf1001', 'individual_adult_membership_profit', 1,
   'percentage', 'draft', 'ZAR', 2, 'custodian',
   'https://docs.google.com/document/d/1p-Lh1ur7Ef74aupkDwxbnvPxLp5KTLKfEhIbdAS4fyY');

INSERT INTO split_policy_rules
  (policy_id, rule_order, rule_code, recipient_type, recipient_mode, basis_points)
VALUES
  ('b4a4e970-8db6-4c53-90fb-1e9eafcf1001', 0, 'custodian', 'KASIHUB_CUSTODIAN', 'system', 5900),
  ('b4a4e970-8db6-4c53-90fb-1e9eafcf1001', 1, 'pioneer_pool', 'KASIPIONEER_POOL', 'system', 100),
  ('b4a4e970-8db6-4c53-90fb-1e9eafcf1001', 2, 'private_pool', 'PRIVATE_POOL', 'system', 100),
  ('b4a4e970-8db6-4c53-90fb-1e9eafcf1001', 3, 'npo_pool', 'NPO_POOL', 'system', 100),
  ('b4a4e970-8db6-4c53-90fb-1e9eafcf1001', 4, 'shareholders_pool', 'KASI_SHAREHOLDERS_POOL', 'system', 3800);

UPDATE split_policies
SET status = 'active',
    approved_by = 'Lelanie Retief',
    approved_on = DATE '2026-08-08'
WHERE id = 'b4a4e970-8db6-4c53-90fb-1e9eafcf1001';

-- R53 six-level ecosystem split v1. Missing/ineligible dynamic recipients are
-- resolved by the application layer to KASIHUB_CUSTODIAN before persistence.
INSERT INTO split_policies
  (id, policy_key, version, policy_kind, status, currency, minor_unit_scale,
   expected_total_minor, source_reference)
VALUES
  ('b4a4e970-8db6-4c53-90fb-1e9eafcf1002', 'ecosystem_upline_r53', 1,
   'fixed', 'draft', 'ZAR', 2, 5300,
   'https://docs.google.com/document/d/1p-Lh1ur7Ef74aupkDwxbnvPxLp5KTLKfEhIbdAS4fyY');

INSERT INTO split_policy_rules
  (policy_id, rule_order, rule_code, recipient_type, recipient_mode, fixed_amount_minor, fallback_recipient_type)
VALUES
  ('b4a4e970-8db6-4c53-90fb-1e9eafcf1002', 0, 'upline_level_1', 'UPLINE_LEVEL_1', 'dynamic', 1300, 'KASIHUB_CUSTODIAN'),
  ('b4a4e970-8db6-4c53-90fb-1e9eafcf1002', 1, 'upline_level_2', 'UPLINE_LEVEL_2', 'dynamic', 1100, 'KASIHUB_CUSTODIAN'),
  ('b4a4e970-8db6-4c53-90fb-1e9eafcf1002', 2, 'upline_level_3', 'UPLINE_LEVEL_3', 'dynamic', 1100, 'KASIHUB_CUSTODIAN'),
  ('b4a4e970-8db6-4c53-90fb-1e9eafcf1002', 3, 'upline_level_4', 'UPLINE_LEVEL_4', 'dynamic', 900, 'KASIHUB_CUSTODIAN'),
  ('b4a4e970-8db6-4c53-90fb-1e9eafcf1002', 4, 'upline_level_5', 'UPLINE_LEVEL_5', 'dynamic', 600, 'KASIHUB_CUSTODIAN'),
  ('b4a4e970-8db6-4c53-90fb-1e9eafcf1002', 5, 'upline_level_6', 'UPLINE_LEVEL_6', 'dynamic', 300, 'KASIHUB_CUSTODIAN');

UPDATE split_policies
SET status = 'active',
    approved_by = 'Lelanie Retief',
    approved_on = DATE '2026-08-08'
WHERE id = 'b4a4e970-8db6-4c53-90fb-1e9eafcf1002';
