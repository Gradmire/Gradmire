-- Consultation booking: accounts, sessions, counsellors, availability,
-- consultations, calendar sync jobs, notifications and audit history.
-- Additive only: existing leads are kept; leads gain a nullable user link.
-- Rollback: 004_consultation_booking.down.sql (drops only the tables added here).

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- -- Accounts
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email VARCHAR(320) NOT NULL,
  email_verified_at TIMESTAMPTZ,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'counsellor', 'admin')),
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  first_name VARCHAR(120) NOT NULL,
  last_name VARCHAR(120),
  phone VARCHAR(20),
  failed_login_count INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX users_email_unique ON users (LOWER(email));

-- Only a SHA-256 hash of the session token and of its CSRF token is stored.
CREATE TABLE sessions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash CHAR(64) NOT NULL UNIQUE,
  csrf_hash CHAR(64) NOT NULL,
  user_agent VARCHAR(200),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ
);
CREATE INDEX sessions_user_index ON sessions (user_id);

CREATE TABLE email_verification_tokens (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash CHAR(64) NOT NULL UNIQUE,
  email VARCHAR(320) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -- Leads: link to an account once identity is verified; bookings as a source
ALTER TABLE leads
  ADD COLUMN user_id UUID REFERENCES users (id) ON DELETE SET NULL,
  ADD COLUMN preferred_course VARCHAR(200),
  ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX leads_user_index ON leads (user_id);
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_source_check;
ALTER TABLE leads ADD CONSTRAINT leads_source_check CHECK (source IN ('consultation', 'contact', 'newsletter', 'booking'));

-- -- Consultation catalogue
CREATE TABLE consultation_types (
  id UUID PRIMARY KEY,
  slug VARCHAR(60) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  description VARCHAR(600) NOT NULL DEFAULT '',
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes BETWEEN 10 AND 240),
  meeting_methods TEXT[] NOT NULL DEFAULT ARRAY['video', 'phone'],
  min_notice_minutes INTEGER NOT NULL DEFAULT 180 CHECK (min_notice_minutes >= 0),
  max_advance_days INTEGER NOT NULL DEFAULT 60 CHECK (max_advance_days BETWEEN 1 AND 365),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT consultation_types_methods_check
    CHECK (CARDINALITY(meeting_methods) > 0 AND meeting_methods <@ ARRAY['video', 'phone', 'in_person'])
);

-- -- Counsellors (staff users) and their availability
CREATE TABLE counsellors (
  user_id UUID PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  display_name VARCHAR(120) NOT NULL,
  timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Kolkata',
  buffer_minutes INTEGER NOT NULL DEFAULT 10 CHECK (buffer_minutes BETWEEN 0 AND 120),
  calendar_id VARCHAR(320),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Recurring weekly working hours, as wall-clock times in `timezone`.
-- Breaks are expressed by splitting a day into several rules (e.g. 10-13, 14-18).
CREATE TABLE availability_rules (
  id UUID PRIMARY KEY,
  counsellor_id UUID NOT NULL REFERENCES counsellors (user_id) ON DELETE CASCADE,
  weekday SMALLINT NOT NULL CHECK (weekday BETWEEN 1 AND 7), -- ISO: 1 = Monday
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  timezone VARCHAR(64) NOT NULL,
  effective_from DATE,
  effective_until DATE,
  created_by UUID REFERENCES users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_time > start_time),
  CHECK (effective_until IS NULL OR effective_from IS NULL OR effective_until >= effective_from)
);
CREATE INDEX availability_rules_counsellor_index ON availability_rules (counsellor_id, weekday);

-- Date-specific unavailable periods (leave, holidays, one-off blocks).
CREATE TABLE availability_exceptions (
  id UUID PRIMARY KEY,
  counsellor_id UUID NOT NULL REFERENCES counsellors (user_id) ON DELETE CASCADE,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  reason VARCHAR(200),
  created_by UUID REFERENCES users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (ends_at > starts_at)
);
CREATE INDEX availability_exceptions_range_index ON availability_exceptions (counsellor_id, starts_at, ends_at);

-- -- Consultations
CREATE TABLE consultations (
  id UUID PRIMARY KEY,
  reference VARCHAR(16) NOT NULL UNIQUE,
  student_user_id UUID REFERENCES users (id) ON DELETE SET NULL,
  lead_id UUID REFERENCES leads (id) ON DELETE SET NULL,
  consultation_type_id UUID NOT NULL REFERENCES consultation_types (id),
  counsellor_id UUID NOT NULL REFERENCES counsellors (user_id),
  student_name VARCHAR(240) NOT NULL,
  student_email VARCHAR(320) NOT NULL,
  student_phone VARCHAR(20) NOT NULL,
  preferred_destination VARCHAR(80),
  intended_degree VARCHAR(80),
  preferred_course VARCHAR(200),
  intended_intake VARCHAR(40),
  academic_summary VARCHAR(500),
  message VARCHAR(2000),
  scheduled_start TIMESTAMPTZ NOT NULL,
  scheduled_end TIMESTAMPTZ NOT NULL,
  -- End of the slot plus the counsellor's buffer; this is what may not overlap.
  blocked_until TIMESTAMPTZ NOT NULL,
  timezone VARCHAR(64) NOT NULL,
  meeting_method VARCHAR(20) NOT NULL CHECK (meeting_method IN ('video', 'phone', 'in_person')),
  meeting_provider VARCHAR(40),
  meeting_url TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'reserved'
    CHECK (status IN ('reserved', 'confirmed', 'completed', 'cancelled', 'no_show', 'rescheduled')),
  calendar_status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (calendar_status IN ('not_required', 'pending', 'synced', 'failed')),
  calendar_event_id VARCHAR(1024),
  calendar_generation INTEGER NOT NULL DEFAULT 1,
  outcome VARCHAR(40) CHECK (outcome IN ('qualified', 'follow_up', 'not_interested', 'application_started', 'other')),
  cancellation_reason VARCHAR(500),
  cancelled_by VARCHAR(20) CHECK (cancelled_by IN ('student', 'staff', 'system')),
  cancelled_at TIMESTAMPTZ,
  rescheduled_from_id UUID UNIQUE REFERENCES consultations (id),
  reschedule_count INTEGER NOT NULL DEFAULT 0,
  -- Guest manage links: token = HMAC(APP_SECRET, seed); only its hash is looked up,
  -- so a database leak alone does not reveal working links.
  manage_token_seed CHAR(43) UNIQUE,
  manage_token_hash CHAR(64) UNIQUE,
  reminders_opt_in BOOLEAN NOT NULL DEFAULT TRUE,
  idempotency_key VARCHAR(100) UNIQUE,
  idempotency_fingerprint CHAR(64),
  source VARCHAR(40) NOT NULL DEFAULT 'website',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (scheduled_end > scheduled_start),
  CHECK (blocked_until >= scheduled_end),
  -- A counsellor cannot hold two active bookings whose blocked ranges overlap.
  CONSTRAINT consultations_counsellor_no_overlap EXCLUDE USING gist (
    counsellor_id WITH =,
    tstzrange(scheduled_start, blocked_until, '[)') WITH &&
  ) WHERE (status IN ('reserved', 'confirmed')),
  -- The same person cannot book two overlapping active consultations.
  CONSTRAINT consultations_student_no_overlap EXCLUDE USING gist (
    LOWER(student_email) WITH =,
    tstzrange(scheduled_start, scheduled_end, '[)') WITH &&
  ) WHERE (status IN ('reserved', 'confirmed'))
);
CREATE INDEX consultations_student_index ON consultations (student_user_id, scheduled_start DESC);
CREATE INDEX consultations_counsellor_index ON consultations (counsellor_id, scheduled_start);
CREATE INDEX consultations_start_index ON consultations (scheduled_start);
CREATE INDEX consultations_status_index ON consultations (status);
CREATE INDEX consultations_email_index ON consultations (LOWER(student_email));

-- Staff-only notes, outcomes and follow-up tasks. Never returned to students.
CREATE TABLE consultation_notes (
  id UUID PRIMARY KEY,
  consultation_id UUID NOT NULL REFERENCES consultations (id) ON DELETE CASCADE,
  author_user_id UUID REFERENCES users (id) ON DELETE SET NULL,
  kind VARCHAR(20) NOT NULL DEFAULT 'note' CHECK (kind IN ('note', 'outcome', 'follow_up')),
  body VARCHAR(4000) NOT NULL,
  due_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX consultation_notes_consultation_index ON consultation_notes (consultation_id, created_at);

-- Appointment history (who did what, when).
CREATE TABLE consultation_events (
  id BIGSERIAL PRIMARY KEY,
  consultation_id UUID NOT NULL REFERENCES consultations (id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES users (id) ON DELETE SET NULL,
  actor_type VARCHAR(20) NOT NULL CHECK (actor_type IN ('student', 'guest', 'staff', 'system')),
  event VARCHAR(40) NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX consultation_events_consultation_index ON consultation_events (consultation_id, id);

-- -- Outbox: calendar sync jobs
CREATE TABLE calendar_sync_jobs (
  id UUID PRIMARY KEY,
  consultation_id UUID NOT NULL REFERENCES consultations (id) ON DELETE CASCADE,
  action VARCHAR(10) NOT NULL CHECK (action IN ('create', 'cancel')),
  generation INTEGER NOT NULL,
  calendar_id VARCHAR(320),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'done', 'failed', 'dead')),
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 6,
  run_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_until TIMESTAMPTZ,
  last_error VARCHAR(1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- One job per action per calendar generation, so a retry never queues a second create.
  UNIQUE (consultation_id, action, generation)
);
CREATE INDEX calendar_sync_jobs_due_index ON calendar_sync_jobs (status, run_at);

-- -- Outbox: notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY,
  consultation_id UUID REFERENCES consultations (id) ON DELETE CASCADE,
  user_id UUID REFERENCES users (id) ON DELETE CASCADE,
  channel VARCHAR(20) NOT NULL DEFAULT 'email' CHECK (channel IN ('email', 'whatsapp')),
  template VARCHAR(40) NOT NULL,
  recipient VARCHAR(320) NOT NULL,
  -- Uniqueness of this key is what prevents duplicate messages on retry.
  dedupe_key VARCHAR(200) NOT NULL UNIQUE,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'skipped', 'cancelled')),
  scheduled_for TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  locked_until TIMESTAMPTZ,
  provider VARCHAR(40),
  provider_message_id VARCHAR(200),
  last_error VARCHAR(1000),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX notifications_due_index ON notifications (status, scheduled_for);
CREATE INDEX notifications_consultation_index ON notifications (consultation_id);

-- -- Audit log for sensitive account and staff actions
CREATE TABLE audit_log (
  id BIGSERIAL PRIMARY KEY,
  actor_user_id UUID REFERENCES users (id) ON DELETE SET NULL,
  action VARCHAR(60) NOT NULL,
  entity_type VARCHAR(40),
  entity_id VARCHAR(64),
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX audit_log_created_index ON audit_log (created_at DESC);

-- -- Fixed-window rate limits shared by every serverless instance
CREATE TABLE rate_limits (
  bucket CHAR(64) NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  hits INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket, window_start)
);

-- -- Seed: the consultation types Gradmire offers (editable via the admin API)
INSERT INTO consultation_types (id, slug, name, description, duration_minutes, meeting_methods, sort_order) VALUES
  ('6f1c2a10-0000-4000-8000-000000000001', 'free-consultation', 'Free study-abroad consultation',
   'An introductory call to understand your goals and map out countries, courses, budget and timelines.', 30, ARRAY['video', 'phone'], 1),
  ('6f1c2a10-0000-4000-8000-000000000002', 'university-selection', 'University selection',
   'Build a balanced shortlist of universities and courses that match your profile, budget and career plans.', 45, ARRAY['video', 'phone'], 2),
  ('6f1c2a10-0000-4000-8000-000000000003', 'profile-evaluation', 'Profile evaluation',
   'A structured review of your academics, test scores and experience, with gaps to close before you apply.', 45, ARRAY['video', 'phone'], 3),
  ('6f1c2a10-0000-4000-8000-000000000004', 'application-guidance', 'Application guidance',
   'Plan your applications: documents, statements of purpose, recommendation letters and deadlines.', 45, ARRAY['video', 'phone'], 4),
  ('6f1c2a10-0000-4000-8000-000000000005', 'visa-guidance', 'Visa guidance',
   'Understand the student-visa process, document checklist and timeline for your destination.', 30, ARRAY['video', 'phone'], 5);
