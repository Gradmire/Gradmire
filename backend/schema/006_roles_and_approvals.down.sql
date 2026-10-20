-- Rollback for 006_roles_and_approvals.sql. Run by hand only, after a backup:
-- it deletes every consultant application, invitation, employee profile,
-- approval request, lead activity, follow-up task and in-app notification.
-- Super admins become admins so the older role check can be restored.
DROP INDEX IF EXISTS audit_log_actor_index;
DROP INDEX IF EXISTS audit_log_entity_index;

DROP TABLE IF EXISTS follow_up_tasks;
DROP TABLE IF EXISTS lead_activities;
DROP INDEX IF EXISTS leads_assigned_index;
DROP INDEX IF EXISTS leads_status_index;
ALTER TABLE leads
  DROP COLUMN IF EXISTS last_contacted_at,
  DROP COLUMN IF EXISTS next_follow_up_at,
  DROP COLUMN IF EXISTS assigned_counsellor_id,
  DROP COLUMN IF EXISTS status;

DROP TABLE IF EXISTS approval_events;
DROP TABLE IF EXISTS approval_requests;
DROP TABLE IF EXISTS employee_profiles;
DROP TABLE IF EXISTS employee_invitations;
DROP TABLE IF EXISTS consultant_application_events;
DROP TABLE IF EXISTS consultant_applications;
DROP TABLE IF EXISTS user_notifications;
DROP TABLE IF EXISTS student_profiles;

DROP INDEX IF EXISTS users_phone_index;
DROP INDEX IF EXISTS users_role_index;
ALTER TABLE users
  DROP COLUMN IF EXISTS status_changed_by,
  DROP COLUMN IF EXISTS status_changed_at,
  DROP COLUMN IF EXISTS status_reason;
UPDATE users SET role = 'admin' WHERE role = 'super_admin';
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('student', 'counsellor', 'admin'));

DELETE FROM schema_migrations WHERE name = '006_roles_and_approvals.sql';
