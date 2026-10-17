-- Rollback for 003_newsletter_source.sql. Newsletter leads have no first name, so
-- they are removed before first_name becomes required again.
DELETE FROM leads WHERE source = 'newsletter';

ALTER TABLE leads ALTER COLUMN first_name SET NOT NULL;

ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_source_check;
ALTER TABLE leads ADD CONSTRAINT leads_source_check CHECK (source IN ('consultation', 'contact'));
