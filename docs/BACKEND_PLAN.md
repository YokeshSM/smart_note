# Smart Notes — Backend Plan

A phased plan to build and maintain the Smart Notes API as an open-source–friendly backend.

---

## 1. Project overview

**Smart Notes** is a notes application with a REST (or GraphQL) API backend, designed to be:

- **Open source**: clear structure, docs, and contribution guidelines
- **Maintainable**: layered architecture, tests, and tooling
- **Extensible**: easy to add features (tags, sharing, search, etc.)

---

## 2. Recommended tech stack

| Layer        | Recommendation   | Alternatives              |
|-------------|------------------|---------------------------|
| **Runtime** | Node.js 20+ LTS  | Python 3.11+ (FastAPI)    |
| **Framework** | Express.js    | Fastify, NestJS, FastAPI  |
| **Database** | PostgreSQL 15+  | SQLite (dev), MySQL       |
| **ORM / Query** | Prisma or Drizzle | TypeORM, raw SQL      |
| **Auth**    | **Google OAuth only** (Sign in with Google); JWT for session after login | —     |
| **Validation** | Zod (Node) / Pydantic (Python) | Joi, class-validator |
| **Tests**   | Vitest or Jest   | pytest (Python)           |
| **API style** | REST (JSON)    | Optional GraphQL later    |

*Pick one column and stick with it for consistency; this plan assumes **Node.js + Express + PostgreSQL + Prisma** unless you say otherwise.*

---

## 3. Repository (monorepo) layout

```
smart_note/
├── .github/                  # GitHub-specific
│   ├── ISSUE_TEMPLATE/        # Bug report, feature request
│   ├── PULL_REQUEST_TEMPLATE.md
│   └── workflows/             # CI (lint, test, build)
├── backend/                   # ← Backend service (this plan)
│   ├── src/
│   │   ├── config/            # Env, constants
│   │   ├── db/                 # Prisma client, migrations
│   │   ├── modules/            # Feature modules (see below)
│   │   ├── middleware/         # Auth, error handling, logging
│   │   ├── routes/             # Route mounting only
│   │   ├── app.ts              # Express app setup
│   │   └── server.ts           # HTTP server entry
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   ├── tests/
│   │   ├── unit/
│   │   └── integration/
│   ├── package.json
│   ├── tsconfig.json
│   └── README.md
├── docs/                      # Project-wide docs
│   ├── architecture.md
│   ├── api.md                 # API reference (OpenAPI)
│   └── contributing.md
├── scripts/                   # Dev/deploy helpers
├── README.md
├── LICENSE
├── CONTRIBUTING.md
└── .gitignore
```

---

## 4. Backend folder structure (detailed)

```
backend/
├── src/
│   ├── config/
│   │   ├── index.ts            # Load env (e.g. dotenv), export config object
│   │   └── constants.ts        # App-wide constants
│   ├── db/
│   │   ├── client.ts           # Prisma client singleton
│   │   └── seed.ts             # Optional seed script
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── auth.routes.ts
│   │   │   ├── auth.middleware.ts   # JWT verify
│   │   │   ├── google.strategy.ts   # Google OAuth: get profile from token/code
│   │   │   └── auth.types.ts
│   │   ├── users/
│   │   │   ├── user.controller.ts
│   │   │   ├── user.service.ts
│   │   │   ├── user.routes.ts
│   │   │   └── user.types.ts
│   │   └── notes/
│   │       ├── note.controller.ts
│   │       ├── note.service.ts
│   │       ├── note.routes.ts
│   │       ├── note.types.ts
│   │       └── note.validation.ts   # Zod schemas
│   ├── middleware/
│   │   ├── errorHandler.ts
│   │   ├── requestId.ts
│   │   └── logger.ts
│   ├── routes/
│   │   └── index.ts            # Mount /api/v1/auth, /api/v1/users, /api/v1/notes
│   ├── app.ts                  # express(), middleware, routes
│   └── server.ts               # listen()
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── tests/
│   ├── unit/
│   │   └── modules/
│   └── integration/
│       └── api/
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

**Principles:**

- **Module per feature** (auth, users, notes): each has routes → controller → service → DB/Prisma.
- **Thin controllers**: parse request, call service, return response.
- **Business logic in services**: reusable and testable.
- **Shared middleware** in `middleware/`; auth-specific in `modules/auth/`.

---

## 5. Core data model (initial)

- **User**: id, **email** (from Google), **googleId** (Google `sub`, unique), **name**, **avatarUrl** (from Google profile), createdAt, updatedAt. No password — **Google sign-in only**.
- **Note**: id, userId (FK), title, content (text), createdAt, updatedAt.

Later: folders, tags, soft delete, sharing.

**Prisma example:**

```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique   // from Google
  googleId  String   @unique   // Google sub
  name      String?  // from Google profile
  avatarUrl String?  // from Google profile
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  notes     Note[]
}

model Note {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  title     String
  content   String   @db.Text
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([userId])
  @@index([userId, updatedAt])
}
```

---

## 6. API design (REST)

Base path: `/api/v1`.

### Auth endpoints (Google only)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET    | /auth/google   | **Redirect to Google** OAuth consent screen | No |
| GET    | /auth/google/callback | **Google callback** — exchange code, create or get user, return JWTs | No |
| POST   | /auth/refresh  | Refresh access token | Refresh token |
| POST   | /auth/logout   | Invalidate refresh token (optional) | Optional |

### User & notes

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET    | /users/me     | Current user profile | Yes |
| PATCH  | /users/me     | Update profile | Yes |
| GET    | /notes        | List notes (paginated) | Yes |
| GET    | /notes/:id    | Get one note | Yes |
| POST   | /notes        | Create note | Yes |
| PATCH  | /notes/:id    | Update note | Yes |
| DELETE | /notes/:id    | Delete note | Yes |

Responses: JSON; consistent shape e.g. `{ data?, error?, meta? }`. Use HTTP status codes (401, 403, 404, 422, 500).

---

## 7. Implementation phases

### Phase 1 — Foundation (Week 1)

- [ ] Initialize `backend/` with Node + TypeScript + Express.
- [ ] Add Prisma, PostgreSQL (or SQLite for local dev), basic `User` and `Note` models.
- [ ] Config: env (port, database URL, JWT secrets), `.env.example`.
- [ ] Health check: `GET /health` (and optionally `/api/v1`).
- [ ] Global middleware: JSON body, error handler, request ID, CORS.
- [ ] README for backend: how to run and test.

### Phase 2 — Auth & users (Google only)

- [ ] Auth module: **Google OAuth** — `GET /auth/google` (redirect), `GET /auth/google/callback` (exchange code, find or create user by `googleId`/email, issue JWTs). See [docs/auth.md](auth.md).
- [ ] User model: `googleId`, `email`, `name`, `avatarUrl` from Google; no password.
- [ ] Auth middleware: verify JWT, attach `req.user`.
- [ ] Users module: GET/PATCH `/users/me` (profile from Google; PATCH only for app-specific prefs if needed).
- [ ] Validation: Zod for callback/refresh payloads if needed.

### Phase 3 — Notes CRUD

- [ ] Notes module: list (with pagination), get by id, create, update, delete.
- [ ] Authorization: ensure note belongs to `req.user.id` for get/update/delete.
- [ ] Validation for note create/update.

### Phase 4 — Quality & open source

- [ ] Unit tests for services; integration tests for key API routes.
- [ ] API docs: OpenAPI (Swagger) spec in `docs/api.md` or served at `/api-docs`.
- [ ] Logging (structured, e.g. pino); optional rate limiting.
- [ ] CI: lint + test on push/PR (e.g. GitHub Actions).
- [ ] CONTRIBUTING.md, CODE_OF_CONDUCT.md, LICENSE (e.g. MIT).

### Phase 5 — Extensions (later)

- [ ] Folders or tags for notes.
- [ ] Full-text search (DB or Elasticsearch).
- [ ] Soft delete / trash.
- [ ] Optional GraphQL layer or export.

---

## 8. Environment & config

- **Development**: `.env` (gitignored); copy from `.env.example`.
- **CI**: Use env vars in GitHub Actions (e.g. `DATABASE_URL` for tests).
- **Secrets**: Never commit JWT secrets or DB URLs; document required vars in README and `.env.example`.

---

## 9. Next steps

1. Confirm stack (Node/Express/Prisma vs Python/FastAPI).
2. Create the `backend/` folder and the structure above.
3. Implement Phase 1 (foundation), then iterate through Phase 2–4.
4. Add `docs/architecture.md` and link to this plan.

Once you confirm the stack and any changes to this plan, we can generate the initial backend scaffold (package.json, tsconfig, Express app, Prisma schema, and health route).
