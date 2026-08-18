-- Author: Klaasvaakie ( |╲ )
-- Reviewer and approval notes use AES-256-GCM. Store the full authenticated
-- encryption envelope so these future protected fields remain decryptable and
-- tamper-evident without weakening the invitation-only application boundary.
ALTER TABLE presale_application_reviews
  ADD COLUMN protected_notes_nonce BYTEA,
  ADD COLUMN protected_notes_auth_tag BYTEA,
  ADD COLUMN protected_notes_key_version TEXT;

ALTER TABLE presale_approval_decisions
  ADD COLUMN protected_comment_nonce BYTEA,
  ADD COLUMN protected_comment_auth_tag BYTEA,
  ADD COLUMN protected_comment_key_version TEXT;

COMMENT ON COLUMN presale_application_reviews.protected_notes_ciphertext IS
  'AES-256-GCM ciphertext; nonce, auth tag, and key version are stored alongside it.';

COMMENT ON COLUMN presale_approval_decisions.protected_comment_ciphertext IS
  'AES-256-GCM ciphertext; nonce, auth tag, and key version are stored alongside it.';
