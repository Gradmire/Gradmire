-- Google sign-in, password reset and data-retention markers. Additive.
-- Rollback: 007_google_login_password_reset_retention.down.sql

-- -- Google sign-in: an account may have a Google identity, a password, or both.
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE users
  ADD COLUMN google_sub VARCHAR(255),
  ADD COLUMN password_changed_at TIMESTAMPTZ;
CREATE UNIQUE INDEX users_google_sub_unique ON users (google_sub) WHERE google_sub IS NOT NULL;

-- -- Password reset: single use, short lived; only the token's hash is stored.
CREATE TABLE password_reset_tokens (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash CHAR(64) NOT NULL UNIQUE,
  email VARCHAR(320) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX password_reset_tokens_user_index ON password_reset_tokens (user_id, created_at DESC);

-- -- Data retention: when personal details were removed from an old record.
ALTER TABLE consultations ADD COLUMN anonymised_at TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN anonymised_at TIMESTAMPTZ;
CREATE INDEX consultations_retention_index ON consultations (scheduled_end) WHERE anonymised_at IS NULL AND student_user_id IS NULL;
CREATE INDEX leads_retention_index ON leads (created_at) WHERE anonymised_at IS NULL AND user_id IS NULL;
