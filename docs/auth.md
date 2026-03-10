# Auth design — Google only (Sign in with Google)

Smart Notes uses **only Google sign-in**. No password, no email/password registration. Name and email come from the user’s Google account.

---

## 1. How it works

- User clicks **“Sign in with Google”**.
- They are redirected to Google to sign in and consent.
- Google redirects back to your app with a `code`.
- Your backend exchanges the `code` for the user’s profile (email, name, picture), **finds or creates** a user, and returns **your own JWTs** (access + refresh) so the client can call the API.

---

## 2. Flow

```
[Client]              [Backend]                [Google]           [DB]
   |                       |                        |                 |
   |  GET /auth/google     |                        |                 |
   |---------------------->|  302 redirect          |                 |
   |  Location: Google     |  ?client_id=...        |                 |
   |  consent URL          |  &redirect_uri=...     |                 |
   |<----------------------|  &scope=email profile  |                 |
   |                       |                        |                 |
   |  User signs in with   |                        |                 |
   |  Google, consents     |                        |                 |
   |----------------------------------------------->|                 |
   |                       |                        |                 |
   |  302 redirect to      |                        |                 |
   |  /auth/google/callback?code=...                |                 |
   |---------------------->|                        |                 |
   |                       |  POST token endpoint  |                 |
   |                       |  code -> tokens       |                 |
   |                       |---------------------->|                 |
   |                       |<----------------------|                 |
   |                       |  GET userinfo         |                 |
   |                       |  (email, name, picture, sub)             |
   |                       |---------------------->|                 |
   |                       |<----------------------|                 |
   |                       |  find or create User  |                 |
   |                       |----------------------------------------->|
   |                       |  sign JWT             |                 |
   |  200 { user,          |                       |                 |
   |        accessToken,   |                       |                 |
   |        refreshToken } |                       |                 |
   |<----------------------|                       |                 |
```

- **Redirect**: `GET /auth/google` builds Google’s authorization URL and responds with **302** to it.
- **Callback**: `GET /auth/google/callback?code=...` — backend exchanges `code` for tokens, gets profile from Google, **find-or-creates** user by `googleId` (Google `sub`) or `email`, then returns your JWTs (e.g. JSON for SPA or redirect to frontend URL with tokens).

---

## 3. User model (Google only)

- **googleId** (required): Google’s `sub`; unique.
- **email** (required): From Google.
- **name**, **avatarUrl**: From Google profile; optional in DB.
- **No password** — no `passwordHash`, no register/login with email+password.

One row per user; one Google account = one user (by `googleId`). If the same email appears again (same Google account), just log them in.

---

## 4. Backend responsibilities

- **Config**: Google OAuth client ID and client secret; redirect URI must match exactly (e.g. `http://localhost:3000/api/v1/auth/google/callback`).
- **Security**: Use `state` to prevent CSRF; exchange `code` once.
- **Find or create**: By `googleId` first; if not found, create user with email, name, avatarUrl from Google.

---

## 5. Env vars

```bash
# JWT (issued after Google sign-in)
JWT_ACCESS_SECRET=...
JWT_REFRESH_SECRET=...
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Google OAuth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALLBACK_URL=http://localhost:3000/api/v1/auth/google/callback
```

---

## 6. Frontend

- Single button: **“Sign in with Google”** → navigate to or open `GET /auth/google`.
- After callback, backend returns `{ user, accessToken, refreshToken }` → store tokens and redirect to app.

See [BACKEND_PLAN.md](BACKEND_PLAN.md) for the full API table and Phase 2 checklist.
