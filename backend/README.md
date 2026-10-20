# Gradmire Backend

The API for the static frontend. It provides:

- Accounts (sign-up, login, sessions, email verification), consultation booking, the student consultations area, the staff CRM and background jobs — see [`docs/consultation-booking-setup.md`](../docs/consultation-booking-setup.md) for every endpoint
- Student applications (migration `005`): counsellors record each university application and its status on `admin-students.html`; students see them on `dashboard.html`. Endpoints: `GET /api/v1/me/applications` (student), `GET /api/v1/admin/students?q=`, `GET|POST /api/v1/admin/students/:id/applications`, `PATCH|DELETE /api/v1/admin/applications/:id` (staff; counsellors only reach students who have a consultation with them)
- `GET /api/v1/health`
- `GET /api/v1/leads`
- `POST /api/v1/leads` — used by the contact form (`source: "contact"`, needs `firstName`, `email`, `message`) and the free-consultation form (`source: "consultation"`, needs `firstName`, `email`, `phone`, `contactConsent`). Unknown fields are dropped.

Data is stored in PostgreSQL when `DATABASE_URL` is set (migrations in `schema/`, applied with `npm run migrate`). Without it, leads fall back to an in-memory store for quick previews; accounts and booking always require the database.

## Run locally

```bash
npm install
npm run db:local        # real local PostgreSQL without Docker (separate terminal)
export DATABASE_URL=postgres://gradmire:gradmire-local@127.0.0.1:54320/gradmire
npm run migrate
npm run check
npm test                # 49 tests against real PostgreSQL
npm start
```

Other scripts: `npm run create-staff` (staff accounts), `npm run worker` (background jobs on a long-running host).

The API listens on `http://localhost:4000` by default. Set `PORT` and `FRONTEND_ORIGIN` (comma-separated list of allowed origins) in the environment to change them; see `.env.example`. Pages load `frontend/assets/api.js`, which calls `http://localhost:4000` on localhost and the same origin elsewhere, unless a page sets `<meta name="gm-api-base" content="…">`.

## Deployment

The API runs as the Vercel project `gradmire-api` (https://gradmire-api.vercel.app), deployed from this folder with `vercel deploy --prod`. It is not connected to Git, so pushing does not redeploy it. The site calls it directly (`frontend/assets/api.js`), and `FRONTEND_ORIGIN` lists the site origins allowed by CORS.

Production builds run `npm run vercel-build`, which applies pending migrations; preview builds skip them. Environment variables (Production):

- `DATABASE_URL`: pooled Neon connection string for the `gradmire` database and role, in the shared `neon-green-garden` Neon project
- `DATABASE_URL_UNPOOLED`: direct connection string, used by migrations
- `ADMIN_API_TOKEN`: bearer token required by `GET /api/v1/leads`
- `APP_SECRET`, `CRON_SECRET`, `SITE_URL`, and optionally the email and calendar variables, for booking (see `.env.example`)
- `FRONTEND_ORIGIN`: `https://gradmire-1nfj.vercel.app` (comma-separate to add a custom domain)
