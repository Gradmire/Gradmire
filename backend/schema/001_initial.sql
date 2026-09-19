CREATE TABLE leads (
  id UUID PRIMARY KEY,
  first_name VARCHAR(120) NOT NULL,
  last_name VARCHAR(120),
  email VARCHAR(320) NOT NULL,
  phone VARCHAR(40) NOT NULL,
  primary_destination VARCHAR(80),
  intended_intake VARCHAR(40),
  marketing_opt_in BOOLEAN NOT NULL DEFAULT FALSE,
  partner_institution_opt_in BOOLEAN NOT NULL DEFAULT FALSE,
  newsletter_opt_in BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX leads_email_unique ON leads (LOWER(email));
CREATE INDEX leads_phone_index ON leads (phone);
