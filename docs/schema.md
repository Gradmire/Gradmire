# Data Schema
## Study Abroad Consultancy & Application Platform

Relational schema (PostgreSQL). Notation: `table_name (column: type, ...)`. FK = foreign key. This is logical schema — adapt names to ORM conventions.

---

## 1. Identity & Access

```sql
users (
  id: uuid PK,
  email: varchar UNIQUE,
  phone: varchar,
  phone_country_code: varchar,
  password_hash: varchar NULL,        -- null if SSO-only
  auth_provider: enum('email','google','apple','otp'),
  role: enum('student','counsellor','branch_admin','content_admin','super_admin'),
  first_name: varchar,
  last_name: varchar,
  nationality: varchar,
  current_country: varchar,
  current_city: varchar,
  passport_status: enum('yes','no','applied'),
  created_at: timestamptz,
  updated_at: timestamptz,
  deleted_at: timestamptz NULL        -- soft delete for GDPR/DPDP
)

sessions (
  id: uuid PK,
  user_id: uuid FK -> users.id,
  refresh_token_hash: varchar,
  ip_address: inet,
  user_agent: text,
  created_at: timestamptz,
  expires_at: timestamptz
)

otp_codes (
  id: uuid PK,
  user_id: uuid FK -> users.id NULL,
  destination: varchar,               -- phone or email being verified
  code_hash: varchar,
  purpose: enum('signup','login','reset_password'),
  expires_at: timestamptz,
  consumed_at: timestamptz NULL
)
```

## 2. Leads / CRM

```sql
leads (
  id: uuid PK,
  user_id: uuid FK -> users.id NULL,   -- linked once account created
  first_name: varchar,
  last_name: varchar,
  email: varchar,
  phone: varchar,
  phone_country_code: varchar,
  intended_intake: varchar,            -- e.g. 'Oct/Nov/Dec 2026'
  primary_destination: varchar,        -- country code/name
  other_destinations: varchar[],       -- multi-select array
  nationality: varchar,
  study_type: enum('undergraduate','postgraduate','research','other') NULL,
  preferred_subject: varchar NULL,
  passport_status: enum('yes','no','applied') NULL,
  how_heard: varchar NULL,             -- 'Email','Google','Social Media',...
  office_country: varchar,
  office_city: varchar,
  office_id: uuid FK -> branches.id NULL,
  marketing_opt_in: boolean DEFAULT false,
  partner_institution_opt_in: boolean DEFAULT false,
  newsletter_opt_in: boolean DEFAULT false,
  form_variant: varchar,               -- 'multi_step_consultation' | 'inline_short'
  utm_source: varchar, utm_medium: varchar, utm_campaign: varchar,
  utm_term: varchar, utm_content: varchar,
  marketing_staff_id: varchar NULL,
  partner_id: varchar NULL,
  referrer: text,
  landing_page: text,
  tracking_mode: varchar,
  stage: enum('new','contacted','qualified','consultation_booked',
              'application_started','enrolled','lost','unresponsive')
         DEFAULT 'new',
  assigned_counsellor_id: uuid FK -> users.id NULL,
  created_at: timestamptz,
  updated_at: timestamptz
)

lead_notes (
  id: uuid PK,
  lead_id: uuid FK -> leads.id,
  author_id: uuid FK -> users.id,
  note_type: enum('note','call_log','email_log','stage_change'),
  content: text,
  created_at: timestamptz
)

lead_dedup_index (
  id: uuid PK,
  normalized_email: varchar,
  normalized_phone: varchar,
  lead_id: uuid FK -> leads.id,
  UNIQUE (normalized_email),
  UNIQUE (normalized_phone)
)
```

## 3. Branches / Offices

```sql
countries (
  code: varchar(2) PK,       -- ISO 3166-1 alpha-2
  name: varchar
)

branches (
  id: uuid PK,
  country_code: varchar FK -> countries.code,
  city: varchar,
  name: varchar,              -- e.g. 'Bengaluru - MG Road'
  address: text,
  phone: varchar,
  latitude: numeric,
  longitude: numeric,
  is_active: boolean DEFAULT true
)

branch_counsellors (
  branch_id: uuid FK -> branches.id,
  counsellor_id: uuid FK -> users.id,
  PRIMARY KEY (branch_id, counsellor_id)
)
```

## 4. Destinations / Content (CMS-backed but modeled relationally for querying)

```sql
destinations (
  id: uuid PK,
  country_code: varchar FK -> countries.code,
  slug: varchar UNIQUE,          -- 'study-in-uk'
  name: varchar,
  overview_html: text,
  hero_image_url: text,
  is_published: boolean DEFAULT false,
  created_at: timestamptz,
  updated_at: timestamptz
)

destination_stats (
  id: uuid PK,
  destination_id: uuid FK -> destinations.id,
  label: varchar,                -- 'Top 100 universities'
  value: varchar,                -- '16 of world's top 100'
  sort_order: int
)

destination_intakes (
  id: uuid PK,
  destination_id: uuid FK -> destinations.id,
  name: varchar,                 -- 'Fall Intake'
  months: varchar                -- 'September/October'
)

destination_costs (
  id: uuid PK,
  destination_id: uuid FK -> destinations.id,
  cost_type: enum('tuition','living'),
  level: varchar NULL,           -- 'undergraduate' | 'postgraduate'
  amount_min: numeric,
  amount_max: numeric,
  currency: varchar,
  period: enum('year','month','total')
)

destination_visa_info (
  id: uuid PK,
  destination_id: uuid FK -> destinations.id,
  visa_name: varchar,            -- 'UK Student Visa'
  application_fee_amount: numeric,
  application_fee_currency: varchar,
  when_to_apply: text,
  required_documents: text[],
  post_study_work_visa_duration: varchar
)

destination_careers (
  id: uuid PK,
  destination_id: uuid FK -> destinations.id,
  job_title: varchar,
  salary_min: numeric,
  salary_max: numeric,
  currency: varchar
)

destination_cities (
  id: uuid PK,
  destination_id: uuid FK -> destinations.id,
  city_name: varchar,
  sort_order: int
)

destination_faqs (
  id: uuid PK,
  destination_id: uuid FK -> destinations.id,
  question: text,
  answer: text,
  sort_order: int
)
```

## 5. Universities / Courses

```sql
universities (
  id: uuid PK,
  slug: varchar UNIQUE,
  name: varchar,
  country_code: varchar FK -> countries.code,
  city: varchar,
  logo_url: text,
  ranking_source: varchar NULL,     -- 'QS','THE'
  ranking_value: int NULL,
  description_html: text,
  website_url: text,
  is_published: boolean DEFAULT true
)

subjects (
  id: uuid PK,
  name: varchar UNIQUE,             -- 'Computer Science'
  category: varchar NULL            -- 'Engineering & IT'
)

study_levels (
  id: serial PK,
  name: varchar UNIQUE              -- 'Undergraduate','Postgraduate','Foundation', etc.
)

courses (
  id: uuid PK,
  university_id: uuid FK -> universities.id,
  subject_id: uuid FK -> subjects.id,
  study_level_id: int FK -> study_levels.id,
  name: varchar,                    -- 'MSc Computer Science'
  duration_months: int NULL,
  tuition_amount: numeric NULL,
  tuition_currency: varchar NULL,
  entry_score_text: varchar NULL,   -- 'N/A' or specific score
  next_intake_date: date NULL,
  ranking_value: int NULL,
  slug: varchar,
  is_published: boolean DEFAULT true
)

-- Many-to-many: a student's shortlist
shortlists (
  id: uuid PK,
  user_id: uuid FK -> users.id,
  course_id: uuid FK -> courses.id NULL,
  university_id: uuid FK -> universities.id NULL,
  created_at: timestamptz,
  UNIQUE (user_id, course_id, university_id)
)
```

## 6. Scholarships

```sql
scholarships (
  id: uuid PK,
  slug: varchar UNIQUE,
  name: varchar,
  destination_id: uuid FK -> destinations.id NULL,
  university_id: uuid FK -> universities.id NULL,
  academic_year: varchar,          -- '2027'
  degree_level: varchar NULL,
  coverage_description: text,
  eligibility_html: text,
  deadline: date NULL,
  application_url: text NULL,
  is_published: boolean DEFAULT true
)
```

## 7. Events

```sql
events (
  id: uuid PK,
  slug: varchar UNIQUE,
  title: varchar,
  description_html: text,
  mode: enum('in_person','online'),
  destination_id: uuid FK -> destinations.id NULL,
  city: varchar NULL,
  branch_id: uuid FK -> branches.id NULL,
  starts_at: timestamptz,
  ends_at: timestamptz,
  capacity: int NULL,
  is_published: boolean DEFAULT true
)

event_registrations (
  id: uuid PK,
  event_id: uuid FK -> events.id,
  user_id: uuid FK -> users.id NULL,
  lead_id: uuid FK -> leads.id NULL,
  name: varchar,
  email: varchar,
  phone: varchar NULL,
  city: varchar NULL,
  registered_at: timestamptz,
  attended: boolean NULL
)
```

## 8. Blog / Study Guides

```sql
blog_posts (
  id: uuid PK,
  slug: varchar UNIQUE,
  title: varchar,
  excerpt: text,
  body_html: text,
  cover_image_url: text,
  destination_id: uuid FK -> destinations.id NULL,
  published_at: timestamptz,
  author_id: uuid FK -> users.id NULL,
  is_published: boolean DEFAULT false
)

blog_tags (
  id: serial PK,
  name: varchar UNIQUE
)

blog_post_tags (
  blog_post_id: uuid FK -> blog_posts.id,
  tag_id: int FK -> blog_tags.id,
  PRIMARY KEY (blog_post_id, tag_id)
)
```

## 9. Applications (Phase 2)

```sql
applications (
  id: uuid PK,
  user_id: uuid FK -> users.id,
  university_id: uuid FK -> universities.id,
  course_id: uuid FK -> courses.id,
  counsellor_id: uuid FK -> users.id NULL,
  stage: enum('shortlisted','documents_pending','submitted','under_review',
              'offer_received','offer_accepted','visa_in_progress','enrolled',
              'rejected','withdrawn') DEFAULT 'shortlisted',
  intake_date: date NULL,
  created_at: timestamptz,
  updated_at: timestamptz
)

application_documents (
  id: uuid PK,
  application_id: uuid FK -> applications.id,
  doc_type: enum('transcript','sop','lor','passport','english_test',
                 'resume','offer_letter','visa_doc','other'),
  file_url: text,
  status: enum('pending','uploaded','verified','rejected') DEFAULT 'pending',
  uploaded_at: timestamptz NULL,
  reviewed_by: uuid FK -> users.id NULL,
  reviewed_at: timestamptz NULL
)

application_activity_log (
  id: uuid PK,
  application_id: uuid FK -> applications.id,
  actor_id: uuid FK -> users.id NULL,   -- null = system
  action: varchar,                       -- 'stage_changed','document_uploaded','note_added'
  details_json: jsonb,
  created_at: timestamptz
)

visa_checklists (
  id: uuid PK,
  application_id: uuid FK -> applications.id,
  item_name: varchar,
  is_complete: boolean DEFAULT false,
  document_id: uuid FK -> application_documents.id NULL
)
```

## 10. Notifications

```sql
notification_templates (
  id: uuid PK,
  code: varchar UNIQUE,           -- 'lead_confirmation','stage_change_offer_received'
  channel: enum('email','sms','whatsapp','in_app'),
  subject: text NULL,
  body_template: text
)

notifications (
  id: uuid PK,
  user_id: uuid FK -> users.id NULL,
  lead_id: uuid FK -> leads.id NULL,
  template_code: varchar FK -> notification_templates.code,
  channel: enum('email','sms','whatsapp','in_app'),
  status: enum('queued','sent','failed','delivered'),
  payload_json: jsonb,
  created_at: timestamptz,
  sent_at: timestamptz NULL
)
```

## 11. Analytics/Audit

```sql
audit_logs (
  id: uuid PK,
  actor_id: uuid FK -> users.id NULL,
  entity_type: varchar,          -- 'destination','scholarship','lead',...
  entity_id: uuid,
  action: enum('create','update','delete','publish','unpublish'),
  diff_json: jsonb,
  created_at: timestamptz
)
```

## 12. Indexing Notes
- `leads(email)`, `leads(phone)` — unique-ish btree indexes for dedup lookups.
- `courses(subject_id, study_level_id)` composite index for finder filtering.
- `universities(country_code)`, `courses` FK indexes for join performance.
- Full-text search (`pg_trgm` or external Meilisearch index) on `universities.name`, `subjects.name` for typeahead.
- `events(starts_at)`, `events(destination_id, mode)` for filter queries.
- Partition `audit_logs` and `application_activity_log` by month if volume grows large.

## 13. Entity Relationship Summary (textual)
- `users` 1—N `leads` (once matched), `applications`, `shortlists`, `event_registrations`.
- `destinations` 1—N `destination_stats/intakes/costs/visa_info/careers/cities/faqs`, and 1—N `scholarships`, `blog_posts`, `events` (optional link).
- `universities` 1—N `courses`; `courses` N—1 `subjects`, N—1 `study_levels`.
- `applications` 1—N `application_documents`, 1—N `application_activity_log`, 1—N `visa_checklists`.
- `branches` 1—N `leads` (via office_id), N—N `users` (counsellors) via `branch_counsellors`.
