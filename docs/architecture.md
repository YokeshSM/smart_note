# Architecture

Smart Notes uses a modular backend with clear separation of concerns.

- **API**: REST over HTTP/JSON; see [BACKEND_PLAN.md](BACKEND_PLAN.md) and API docs for endpoints.
- **Backend layout**: `backend/src/modules/` — one folder per feature (auth, users, notes); shared middleware and config at top level.
- **Data**: PostgreSQL with Prisma ORM; migrations in `backend/prisma/migrations/`.
- **Auth**: **Google only** (Sign in with Google); see [auth.md](auth.md).

More detail is in [BACKEND_PLAN.md](BACKEND_PLAN.md).
