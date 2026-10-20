-- Rollback for 007. Run by hand after a backup. Google-only accounts (no
-- password) get an unusable password hash so password_hash can be NOT NULL
-- again; they can regain access only through support.
DROP INDEX IF EXISTS leads_retention_index;
DROP INDEX IF EXISTS consultations_retention_index;
ALTER TABLE leads DROP COLUMN IF EXISTS anonymised_at;
ALTER TABLE consultations DROP COLUMN IF EXISTS anonymised_at;

DROP TABLE IF EXISTS password_reset_tokens;

UPDATE users SET password_hash = '!disabled' WHERE password_hash IS NULL;
ALTER TABLE users ALTER COLUMN password_hash SET NOT NULL;
DROP INDEX IF EXISTS users_google_sub_unique;
ALTER TABLE users DROP COLUMN IF EXISTS google_sub, DROP COLUMN IF EXISTS password_changed_at;

DELETE FROM schema_migrations WHERE name = '007_google_login_password_reset_retention.sql';
