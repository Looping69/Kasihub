-- Author: Klaasvaakie ( |╲ )
-- One non-secret audit stream for reservation lifecycle transitions.
CREATE OR REPLACE FUNCTION audit_presale_order_lifecycle() RETURNS trigger AS $$
DECLARE event_name text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    event_name := 'reservation.created';
  ELSIF OLD.status IS NOT DISTINCT FROM NEW.status
    AND OLD.incorporation_status IS NOT DISTINCT FROM NEW.incorporation_status THEN
    RETURN NEW;
  ELSIF NEW.incorporation_status = 'incorporated' AND OLD.incorporation_status <> 'incorporated' THEN
    event_name := 'incorporation.completed';
  ELSE
    event_name := CASE NEW.status
      WHEN 'payment_submitted' THEN 'payment.proof_submitted'
      WHEN 'payment_detected' THEN 'payment.detected'
      WHEN 'manual_review' THEN 'payment.manual_review'
      WHEN 'confirmed' THEN 'payment.settled'
      WHEN 'cancelled' THEN 'reservation.cancelled'
      WHEN 'expired' THEN 'reservation.expired'
      WHEN 'incorporated' THEN 'shares.issued'
      ELSE 'reservation.state_changed'
    END;
  END IF;
  INSERT INTO presale_audit_events(event_key,order_id,event_type,actor_type,actor_reference,evidence)
  VALUES ('presale-order:' || NEW.id || ':' || gen_random_uuid(), NEW.id, event_name, 'system', 'presale.lifecycle',
    jsonb_build_object('priorStatus', CASE WHEN TG_OP='INSERT' THEN NULL ELSE OLD.status END,
      'newStatus', NEW.status, 'priorIncorporationStatus', CASE WHEN TG_OP='INSERT' THEN NULL ELSE OLD.incorporation_status END,
      'newIncorporationStatus', NEW.incorporation_status, 'orderReference', NEW.order_reference));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER presale_order_lifecycle_audit
AFTER INSERT OR UPDATE OF status, incorporation_status ON presale_orders
FOR EACH ROW EXECUTE FUNCTION audit_presale_order_lifecycle();
