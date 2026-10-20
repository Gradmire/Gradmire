-- Rollback for 008_google_workspace.sql. Run by hand only, after a backup: it
-- deletes document records (the files stay in Drive), document requests,
-- staff email records and pending email changes.
DROP INDEX IF EXISTS leads_follow_up_index;
DROP INDEX IF EXISTS follow_up_tasks_due_index;
ALTER TABLE leads DROP COLUMN IF EXISTS follow_up_reminded_for;
ALTER TABLE follow_up_tasks DROP COLUMN IF EXISTS reminded_for;

DROP TABLE IF EXISTS email_change_requests;

DELETE FROM lead_activities WHERE kind = 'email_sent';
ALTER TABLE lead_activities DROP CONSTRAINT IF EXISTS lead_activities_kind_check;
ALTER TABLE lead_activities ADD CONSTRAINT lead_activities_kind_check
  CHECK (kind IN ('note', 'contact_attempt', 'status_changed', 'assigned', 'linked'));
DROP TABLE IF EXISTS staff_emails;

ALTER TABLE consultant_applications
  DROP COLUMN IF EXISTS interview_calendar_status,
  DROP COLUMN IF EXISTS interview_meet_url,
  DROP COLUMN IF EXISTS interview_event_id,
  DROP COLUMN IF EXISTS interview_calendar_id,
  DROP COLUMN IF EXISTS interview_generation,
  DROP COLUMN IF EXISTS cv_document_id;

DROP TABLE IF EXISTS document_requests;
DROP TABLE IF EXISTS documents;

DELETE FROM schema_migrations WHERE name = '008_google_workspace.sql';
