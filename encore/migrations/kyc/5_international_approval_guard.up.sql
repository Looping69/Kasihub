-- Author: Klaasvaakie ( |╲ )
-- Fail closed: no code path may approve Kasihub international KYC unless a
-- versioned evidence policy has explicitly been evaluated and satisfied.

CREATE OR REPLACE FUNCTION guard_international_kyc_approval()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.provider = 'kasihub_international'
     AND NEW.status = 'approved'
     AND OLD.status IS DISTINCT FROM 'approved' THEN
    IF COALESCE(NEW.result_payload->>'policySatisfied', 'false') <> 'true'
       OR NULLIF(BTRIM(COALESCE(NEW.result_payload->>'policyVersion', '')), '') IS NULL THEN
      RAISE EXCEPTION 'international_kyc_policy_not_satisfied';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_guard_international_kyc_approval ON kyc_cases;
CREATE TRIGGER trg_guard_international_kyc_approval
BEFORE UPDATE OF status, result_payload ON kyc_cases
FOR EACH ROW
EXECUTE FUNCTION guard_international_kyc_approval();
