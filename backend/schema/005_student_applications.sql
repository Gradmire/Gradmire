-- University applications a student is making, tracked by their counsellor and shown
-- to the student on their dashboard. Staff write; students only read their own rows.
CREATE TABLE student_applications (
  id UUID PRIMARY KEY,
  student_user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  university VARCHAR(200) NOT NULL,
  course VARCHAR(200) NOT NULL,
  country VARCHAR(80),
  intake VARCHAR(40),
  status VARCHAR(30) NOT NULL DEFAULT 'shortlisted' CHECK (status IN (
    'shortlisted', 'preparing', 'submitted', 'offer_conditional', 'offer_unconditional',
    'accepted', 'visa_applied', 'visa_granted', 'enrolled', 'rejected', 'withdrawn'
  )),
  deadline DATE,
  -- Shown to the student. Private staff notes belong on consultation notes, not here.
  student_note VARCHAR(1000),
  created_by UUID REFERENCES users (id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX student_applications_student ON student_applications (student_user_id, updated_at DESC);
