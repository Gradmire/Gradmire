-- Role-based dashboards: super admins, student profiles, in-app notifications,
-- consultant applications, employee onboarding, approval requests, lead
-- management and follow-up tasks.
-- Additive: existing users, leads and consultations are kept unchanged.
-- Rollback: 006_roles_and_approvals.down.sql.
--
-- History-bearing tables reference users with ON DELETE RESTRICT: accounts are
-- never deleted by the application, and these rows must outlive role changes.

-- -- Roles: a person keeps one users.id for life; the role column changes.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('student', 'counsellor', 'admin', 'super_admin'));
ALTER TABLE users
  ADD COLUMN status_reason VARCHAR(500),
  ADD COLUMN status_changed_at TIMESTAMPTZ,
  ADD COLUMN status_changed_by UUID REFERENCES users (id) ON DELETE SET NULL;
CREATE INDEX users_role_index ON users (role, created_at DESC);
CREATE INDEX users_phone_index ON users (phone);

-- -- Student profile: only what counselling needs (no date of birth, no ID numbers).
CREATE TABLE student_profiles (
  user_id UUID PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  destinations TEXT[] NOT NULL DEFAULT '{}',
  intended_intake VARCHAR(40),
  study_level VARCHAR(80),
  preferred_course VARCHAR(200),
  highest_qualification VARCHAR(200),
  academic_score VARCHAR(80),
  english_test VARCHAR(40),
  english_score VARCHAR(40),
  budget_range VARCHAR(40),
  consultation_language VARCHAR(40),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (CARDINALITY(destinations) <= 5)
);

-- -- In-app notification centre (the `notifications` table stays the email outbox).
CREATE TABLE user_notifications (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  kind VARCHAR(60) NOT NULL,
  title VARCHAR(200) NOT NULL,
  body VARCHAR(1000) NOT NULL DEFAULT '',
  -- A page of this site, written by the server (never user input).
  link VARCHAR(200),
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX user_notifications_user_index ON user_notifications (user_id, created_at DESC);
CREATE INDEX user_notifications_unread_index ON user_notifications (user_id) WHERE read_at IS NULL;

-- -- Consultant applications (recruitment), separate from the account record.
CREATE TABLE consultant_applications (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  status VARCHAR(30) NOT NULL DEFAULT 'submitted' CHECK (status IN (
    'submitted', 'info_requested', 'under_review', 'shortlisted', 'interview_scheduled',
    'interview_completed', 'approved', 'rejected', 'withdrawn'
  )),
  full_name VARCHAR(240) NOT NULL,
  email VARCHAR(320) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  location VARCHAR(120) NOT NULL,
  years_experience SMALLINT NOT NULL CHECK (years_experience BETWEEN 0 AND 60),
  professional_experience VARCHAR(3000) NOT NULL,
  education VARCHAR(2000) NOT NULL,
  counselling_experience VARCHAR(3000),
  languages TEXT[] NOT NULL DEFAULT '{}',
  expertise TEXT[] NOT NULL DEFAULT '{}',
  availability VARCHAR(20) NOT NULL CHECK (availability IN ('full_time', 'part_time', 'contract')),
  -- No private file storage exists, so a CV is an optional https:// link shown only to reviewers.
  cv_url VARCHAR(500),
  additional_info VARCHAR(2000),
  consent_at TIMESTAMPTZ NOT NULL,
  reviewer_user_id UUID REFERENCES users (id) ON DELETE SET NULL,
  interview_at TIMESTAMPTZ,
  -- The only reviewer text an applicant ever sees.
  applicant_message VARCHAR(1000),
  decided_by UUID REFERENCES users (id) ON DELETE SET NULL,
  decided_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (CARDINALITY(languages) <= 10 AND CARDINALITY(expertise) <= 10)
);
-- One open application per person.
CREATE UNIQUE INDEX consultant_applications_one_open ON consultant_applications (user_id)
  WHERE status NOT IN ('approved', 'rejected', 'withdrawn');
CREATE INDEX consultant_applications_status_index ON consultant_applications (status, submitted_at DESC);

-- Status history and private reviewer notes. Never returned to the applicant.
CREATE TABLE consultant_application_events (
  id BIGSERIAL PRIMARY KEY,
  application_id UUID NOT NULL REFERENCES consultant_applications (id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES users (id) ON DELETE SET NULL,
  event VARCHAR(40) NOT NULL,
  from_status VARCHAR(30),
  to_status VARCHAR(30),
  internal_note VARCHAR(2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX consultant_application_events_index ON consultant_application_events (application_id, id);

-- -- Employee onboarding
CREATE TABLE employee_invitations (
  id UUID PRIMARY KEY,
  -- The address the invitation is sent to; the accepting account must have verified it.
  email VARCHAR(320) NOT NULL,
  full_name VARCHAR(240) NOT NULL,
  work_email VARCHAR(320),
  employee_code VARCHAR(40),
  department VARCHAR(80) NOT NULL,
  job_title VARCHAR(120) NOT NULL,
  -- super_admin is never granted by invitation, only by a role-change request.
  intended_role VARCHAR(20) NOT NULL CHECK (intended_role IN ('counsellor', 'admin')),
  manager_user_id UUID REFERENCES users (id) ON DELETE SET NULL,
  start_date DATE,
  application_id UUID REFERENCES consultant_applications (id) ON DELETE SET NULL,
  -- token = HMAC(APP_SECRET, 'invite:' || id); only its hash is stored.
  token_hash CHAR(64) NOT NULL UNIQUE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked')),
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  accepted_user_id UUID REFERENCES users (id) ON DELETE RESTRICT,
  created_by UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX employee_invitations_one_pending ON employee_invitations (LOWER(email)) WHERE status = 'pending';
CREATE INDEX employee_invitations_status_index ON employee_invitations (status, created_at DESC);

-- Employment data, kept apart from the student profile. One row per person;
-- a re-hire reuses it.
CREATE TABLE employee_profiles (
  user_id UUID PRIMARY KEY REFERENCES users (id) ON DELETE RESTRICT,
  employee_code VARCHAR(40) UNIQUE,
  work_email VARCHAR(320),
  department VARCHAR(80) NOT NULL,
  job_title VARCHAR(120) NOT NULL,
  manager_user_id UUID REFERENCES users (id) ON DELETE SET NULL,
  start_date DATE,
  system_role VARCHAR(20) NOT NULL CHECK (system_role IN ('counsellor', 'admin', 'super_admin')),
  employment_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (employment_status IN ('pending', 'active', 'terminated')),
  invitation_id UUID REFERENCES employee_invitations (id) ON DELETE SET NULL,
  created_by UUID REFERENCES users (id) ON DELETE SET NULL,
  approved_by UUID REFERENCES users (id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  terminated_by UUID REFERENCES users (id) ON DELETE SET NULL,
  terminated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX employee_profiles_status_index ON employee_profiles (employment_status);

-- -- Approval requests: every grant or removal of staff access goes through one.
CREATE TABLE approval_requests (
  id UUID PRIMARY KEY,
  type VARCHAR(30) NOT NULL CHECK (type IN ('employee_activation', 'role_change', 'access_revocation')),
  target_user_id UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  from_role VARCHAR(20) NOT NULL,
  requested_role VARCHAR(20) NOT NULL CHECK (requested_role IN ('student', 'counsellor', 'admin', 'super_admin')),
  requested_by UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  assigned_approver_id UUID REFERENCES users (id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'info_requested', 'approved', 'rejected', 'cancelled')),
  reason VARCHAR(1000) NOT NULL,
  reviewer_comment VARCHAR(1000),
  related_entity_type VARCHAR(40),
  related_entity_id UUID,
  -- Access revocation: who takes over the person's future consultations, leads and tasks.
  reassign_to_counsellor_id UUID REFERENCES counsellors (user_id) ON DELETE SET NULL,
  decided_by UUID REFERENCES users (id) ON DELETE RESTRICT,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Two-person rule, enforced by the database as well as the service:
  -- nobody requests a change to their own access, and nobody decides a request
  -- they made or one that changes their own access.
  CONSTRAINT approval_requests_not_self_requested CHECK (requested_by <> target_user_id),
  CONSTRAINT approval_requests_not_self_decided CHECK (decided_by IS NULL OR (decided_by <> requested_by AND decided_by <> target_user_id))
);
CREATE UNIQUE INDEX approval_requests_one_open ON approval_requests (target_user_id) WHERE status IN ('pending', 'info_requested');
CREATE INDEX approval_requests_status_index ON approval_requests (status, created_at DESC);

CREATE TABLE approval_events (
  id BIGSERIAL PRIMARY KEY,
  request_id UUID NOT NULL REFERENCES approval_requests (id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES users (id) ON DELETE SET NULL,
  action VARCHAR(30) NOT NULL,
  comment VARCHAR(1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX approval_events_request_index ON approval_events (request_id, id);

-- -- Lead management
ALTER TABLE leads
  ADD COLUMN status VARCHAR(30) NOT NULL DEFAULT 'new' CHECK (status IN (
    'new', 'contacted', 'qualified', 'consultation_booked', 'converted', 'not_interested', 'closed'
  )),
  ADD COLUMN assigned_counsellor_id UUID REFERENCES counsellors (user_id) ON DELETE SET NULL,
  ADD COLUMN next_follow_up_at TIMESTAMPTZ,
  ADD COLUMN last_contacted_at TIMESTAMPTZ;
UPDATE leads SET status = CASE WHEN user_id IS NOT NULL THEN 'converted' WHEN source = 'booking' THEN 'consultation_booked' ELSE 'new' END;
CREATE INDEX leads_status_index ON leads (status, created_at DESC);
CREATE INDEX leads_assigned_index ON leads (assigned_counsellor_id, status);

CREATE TABLE lead_activities (
  id BIGSERIAL PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES leads (id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES users (id) ON DELETE SET NULL,
  kind VARCHAR(30) NOT NULL CHECK (kind IN ('note', 'contact_attempt', 'status_changed', 'assigned', 'linked')),
  channel VARCHAR(20) CHECK (channel IN ('phone', 'email', 'whatsapp', 'other')),
  body VARCHAR(2000),
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX lead_activities_lead_index ON lead_activities (lead_id, id);

-- -- Follow-up tasks linked to a student, a lead or a consultation
CREATE TABLE follow_up_tasks (
  id UUID PRIMARY KEY,
  assignee_user_id UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  created_by UUID REFERENCES users (id) ON DELETE SET NULL,
  student_user_id UUID REFERENCES users (id) ON DELETE SET NULL,
  lead_id UUID REFERENCES leads (id) ON DELETE SET NULL,
  consultation_id UUID REFERENCES consultations (id) ON DELETE SET NULL,
  title VARCHAR(200) NOT NULL,
  details VARCHAR(2000),
  due_at TIMESTAMPTZ,
  priority VARCHAR(10) NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high')),
  status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done', 'cancelled')),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX follow_up_tasks_assignee_index ON follow_up_tasks (assignee_user_id, status, due_at);

-- -- Audit log lookups by record and by person
CREATE INDEX audit_log_entity_index ON audit_log (entity_type, entity_id, created_at DESC);
CREATE INDEX audit_log_actor_index ON audit_log (actor_user_id, created_at DESC);
