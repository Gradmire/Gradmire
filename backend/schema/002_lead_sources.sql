-- Leads now come from both the contact form and the free-consultation form, and
-- the same person can send more than one enquiry, so email is no longer unique.
DROP INDEX IF EXISTS leads_email_unique;
CREATE INDEX leads_email_index ON leads (LOWER(email));

ALTER TABLE leads ALTER COLUMN phone DROP NOT NULL;

ALTER TABLE leads
  ADD COLUMN source VARCHAR(20) NOT NULL DEFAULT 'consultation' CHECK (source IN ('consultation', 'contact')),
  ADD COLUMN study_level VARCHAR(80),
  ADD COLUMN service_interest VARCHAR(80),
  ADD COLUMN branch VARCHAR(80),
  ADD COLUMN country VARCHAR(80),
  ADD COLUMN passport_status VARCHAR(120),
  ADD COLUMN referral_source VARCHAR(120),
  ADD COLUMN enquiry_type VARCHAR(120),
  ADD COLUMN message TEXT,
  ADD COLUMN contact_consent BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN age_confirmation BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX leads_created_at_index ON leads (created_at DESC);
