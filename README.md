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

See `frontend/README.md` and `backend/README.md` for local development notes.
