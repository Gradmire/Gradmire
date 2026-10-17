-- Rollback for 002_lead_sources.sql. Contact-form leads have no phone, so they are
-- removed before phone becomes required again.
DROP INDEX IF EXISTS leads_created_at_index;

ALTER TABLE leads
  DROP COLUMN source,
  DROP COLUMN study_level,
  DROP COLUMN service_interest,
  DROP COLUMN branch,
  DROP COLUMN country,
  DROP COLUMN passport_status,
  DROP COLUMN referral_source,
  DROP COLUMN enquiry_type,
  DROP COLUMN message,
  DROP COLUMN contact_consent,
  DROP COLUMN age_confirmation;

DELETE FROM leads WHERE phone IS NULL;
ALTER TABLE leads ALTER COLUMN phone SET NOT NULL;

DROP INDEX IF EXISTS leads_email_index;
CREATE UNIQUE INDEX leads_email_unique ON leads (LOWER(email));
