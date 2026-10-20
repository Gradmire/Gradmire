-- Google Workspace features: private documents (Google Drive), document
-- requests, staff emails (Gmail), login email changes, consultant interviews
-- with Google Meet, and follow-up reminder tracking.
-- Additive. Rollback: 008_google_workspace.down.sql.

-- -- Documents: metadata here, file content in private storage (Drive).
CREATE TABLE documents (
  id UUID PRIMARY KEY,
  owner_user_id UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  kind VARCHAR(30) NOT NULL CHECK (kind IN (
    'cv', 'transcript', 'passport', 'english_test', 'sop', 'recommendation', 'financial', 'offer_letter', 'other'
  )),
  filename VARCHAR(200) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  size_bytes INTEGER NOT NULL CHECK (size_bytes > 0),
  sha256 CHAR(64) NOT NULL,
  storage_provider VARCHAR(20) NOT NULL,
  -- Provider file id (Drive) or local key. Never sent to browsers.
  storage_key VARCHAR(200) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deleted')),
  uploaded_by UUID REFERENCES users (id) ON DELETE SET NULL,
  deleted_by UUID REFERENCES users (id) ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX documents_owner_index ON documents (owner_user_id, status, created_at DESC);

-- Staff ask a student for a document; the student's upload fulfils it.
CREATE TABLE document_requests (
  id UUID PRIMARY KEY,
  student_user_id UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  requested_by UUID REFERENCES users (id) ON DELETE SET NULL,
  kind VARCHAR(30) NOT NULL DEFAULT 'other' CHECK (kind IN (
    'transcript', 'passport', 'english_test', 'sop', 'recommendation', 'financial', 'offer_letter', 'other'
  )),
  title VARCHAR(200) NOT NULL,
  details VARCHAR(1000),
  due_date DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'fulfilled', 'cancelled')),
  document_id UUID REFERENCES documents (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX document_requests_student_index ON document_requests (student_user_id, status);

-- -- Consultant applications: uploaded CV and the interview meeting.
ALTER TABLE consultant_applications
  ADD COLUMN cv_document_id UUID REFERENCES documents (id) ON DELETE SET NULL,
  ADD COLUMN interview_generation INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN interview_calendar_id VARCHAR(320),
  ADD COLUMN interview_event_id VARCHAR(1024),
  ADD COLUMN interview_meet_url TEXT,
  ADD COLUMN interview_calendar_status VARCHAR(20) NOT NULL DEFAULT 'not_required'
    CHECK (interview_calendar_status IN ('not_required', 'pending', 'synced', 'failed'));

-- -- Emails written by staff from the dashboard (sent through Gmail).
CREATE TABLE staff_emails (
  id UUID PRIMARY KEY,
  sender_user_id UUID REFERENCES users (id) ON DELETE SET NULL,
  student_user_id UUID REFERENCES users (id) ON DELETE SET NULL,
  lead_id UUID REFERENCES leads (id) ON DELETE SET NULL,
  recipient VARCHAR(320) NOT NULL,
  subject VARCHAR(250) NOT NULL,
  body VARCHAR(10000) NOT NULL,
  gmail_message_id VARCHAR(100),
  gmail_thread_id VARCHAR(100),
  status VARCHAR(20) NOT NULL CHECK (status IN ('sent', 'failed')),
  error VARCHAR(500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX staff_emails_student_index ON staff_emails (student_user_id, created_at DESC);
CREATE INDEX staff_emails_lead_index ON staff_emails (lead_id, created_at DESC);

ALTER TABLE lead_activities DROP CONSTRAINT IF EXISTS lead_activities_kind_check;
ALTER TABLE lead_activities ADD CONSTRAINT lead_activities_kind_check
  CHECK (kind IN ('note', 'contact_attempt', 'status_changed', 'assigned', 'linked', 'email_sent'));

-- -- Login email changes: the new address must be confirmed by a link sent to it.
-- token = HMAC(APP_SECRET, 'email-change:' || id); only its hash is stored.
CREATE TABLE email_change_requests (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  new_email VARCHAR(320) NOT NULL,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX email_change_requests_user_index ON email_change_requests (user_id, created_at DESC);

-- -- Follow-up reminders: remember which due time was already reminded, so a
-- moved due date gets a new reminder and an unchanged one never gets two.
ALTER TABLE follow_up_tasks ADD COLUMN reminded_for TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN follow_up_reminded_for TIMESTAMPTZ;
CREATE INDEX follow_up_tasks_due_index ON follow_up_tasks (due_at) WHERE status = 'open';
CREATE INDEX leads_follow_up_index ON leads (next_follow_up_at) WHERE next_follow_up_at IS NOT NULL;
