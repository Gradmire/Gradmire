# Gradmire Backend

A small API boundary for the static frontend prototype. It currently provides:

- `GET /api/v1/health`
- `GET /api/v1/leads`
- `POST /api/v1/leads` — used by the contact form (`source: "contact"`, needs `firstName`, `email`, `message`) and the free-consultation form (`source: "consultation"`, needs `firstName`, `email`, `phone`, `contactConsent`). Unknown fields are dropped.

The runtime store is intentionally in memory while the product is being scaffolded. `schema/001_initial.sql` is the first PostgreSQL migration for replacing it with durable storage.

## Run locally

```bash
npm install
npm run check
npm start
```

The API listens on `http://localhost:4000` by default. Set `PORT` and `FRONTEND_ORIGIN` (comma-separated list of allowed origins) in the environment to change them; see `.env.example`. Pages load `frontend/assets/api.js`, which calls `http://localhost:4000` on localhost and the same origin elsewhere, unless a page sets `<meta name="gm-api-base" content="…">`.
