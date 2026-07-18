-- Author: Klaasvaakie ( |╲ )
ALTER TABLE whatsapp_contacts
  DROP CONSTRAINT whatsapp_contacts_phone_e164_check;

ALTER TABLE whatsapp_contacts
  ADD CONSTRAINT whatsapp_contacts_phone_e164_check
  CHECK (phone_e164 ~ '^[+][1-9][0-9]{7,14}$');
