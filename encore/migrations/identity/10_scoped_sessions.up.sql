-- Author: Klaasvaakie ( |╲ )
-- Presale applicants authenticate into a purpose-limited KaSiShares surface.
-- Existing sessions remain ecosystem sessions and cannot silently become
-- presale sessions.
ALTER TABLE sessions
  ADD COLUMN session_scope TEXT NOT NULL DEFAULT 'ecosystem'
  CHECK (session_scope IN ('ecosystem', 'presale'));

CREATE INDEX idx_sessions_scope_active
  ON sessions (user_id, session_scope, expires_at)
  WHERE revoked_at IS NULL;
