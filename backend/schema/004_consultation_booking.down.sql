-- Rollback for 004_consultation_booking.sql. Run by hand only, after a backup:
-- it deletes every account, booking, note and notification created since 004.
-- Leads are kept; booking-sourced leads are relabelled 'consultation' so the
-- older source check can be restored, and the added lead columns are dropped.
DROP TABLE IF EXISTS rate_limits;
DROP TABLE IF EXISTS audit_log;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS calendar_sync_jobs;
DROP TABLE IF EXISTS consultation_events;
DROP TABLE IF EXISTS consultation_notes;
DROP TABLE IF EXISTS consultations;
DROP TABLE IF EXISTS availability_exceptions;
DROP TABLE IF EXISTS availability_rules;
DROP TABLE IF EXISTS counsellors;
DROP TABLE IF EXISTS consultation_types;

UPDATE leads SET source = 'consultation' WHERE source = 'booking';
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_source_check;
ALTER TABLE leads ADD CONSTRAINT leads_source_check CHECK (source IN ('consultation', 'contact', 'newsletter'));
DROP INDEX IF EXISTS leads_user_index;
ALTER TABLE leads DROP COLUMN IF EXISTS user_id, DROP COLUMN IF EXISTS preferred_course, DROP COLUMN IF EXISTS updated_at;

DROP TABLE IF EXISTS email_verification_tokens;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS users;

DELETE FROM schema_migrations WHERE name = '004_consultation_booking.sql';
-- btree_gist is left installed; it is harmless and may be used elsewhere.
