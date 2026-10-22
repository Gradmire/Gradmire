# Gradmire

Gradmire is a study-abroad consultancy and application platform prototype.

## Repository layout

- `frontend/pages/` contains the current static website pages and tools.
- `frontend/assets/` contains logos and Earth visualization textures.
- `backend/` contains the API: leads, student and staff accounts, and the consultation booking system, with PostgreSQL migrations and tests.
- `docs/` contains the product, architecture, schema, design, implementation, and delivery notes.

## Run the API

```bash
cd backend
npm install
npm run check
npm test
npm start
```

## Consultation booking

Visitors book at `/book-consultation`, students see bookings at `/dashboard/consultations`,
and staff manage them at `/admin/consultations`. Setup, environment variables, migrations,
calendar/email configuration, background jobs and deployment are in
[`docs/consultation-booking-setup.md`](docs/consultation-booking-setup.md). The pre-build audit is in
[`docs/consultation-booking-audit.md`](docs/consultation-booking-audit.md).

## Role-based workspaces

Students, consultants and administrators each have their own workspace (`/dashboard`, `/consultant/dashboard`, `/admin`).
Staff access is granted, changed and removed only through approval requests decided by a second person.
See [`docs/role-based-dashboard-setup.md`](docs/role-based-dashboard-setup.md) (setup, API),
[`docs/role-permissions-matrix.md`](docs/role-permissions-matrix.md),
[`docs/approval-workflows.md`](docs/approval-workflows.md) and
[`docs/role-based-dashboard-architecture.md`](docs/role-based-dashboard-architecture.md).
Gmail (system email, CRM inbox, compose/reply), Google Drive (documents and CVs) and Google Meet
(consultations and interviews) are set up as described in [`docs/google-workspace-setup.md`](docs/google-workspace-setup.md).

See `frontend/README.md` and `backend/README.md` for local development notes.

## SEO skills

This workspace includes SEO and GEO skills in `.agents/skills/` for site audits,
keyword research, rank tracking, competitor gaps, backlinks, AI visibility,
content briefs, and SEO-versus-ads analysis. They use the Ryze MCP connector,
configured for this workspace in `.vscode/mcp.json`. Sign in and authorize the
accounts you want to use when VS Code prompts; the connector cannot return
account data until that setup is complete.
