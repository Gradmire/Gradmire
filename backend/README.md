# Gradmire Backend

A small API boundary for the static frontend prototype. It currently provides:

- `GET /api/v1/health`
- `GET /api/v1/leads`
- `POST /api/v1/leads`

The runtime store is intentionally in memory while the product is being scaffolded. `schema/001_initial.sql` is the first PostgreSQL migration for replacing it with durable storage.

## Run locally

```bash
npm install
npm run check
npm start
```

The API listens on `http://localhost:4000` by default. Copy `.env.example` to `.env` to change the port or frontend origin.
