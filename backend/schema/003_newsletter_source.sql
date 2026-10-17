-- The footer email box subscribes visitors to updates with just an email address,
-- so newsletter leads have no name. Allow the new source and a missing first name.
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_source_check;
ALTER TABLE leads ADD CONSTRAINT leads_source_check CHECK (source IN ('consultation', 'contact', 'newsletter'));

ALTER TABLE leads ALTER COLUMN first_name DROP NOT NULL;
