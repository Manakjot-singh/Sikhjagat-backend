# Sikh Jagat — Backend API

A small Node.js/Express server that replaces the old localStorage-only
version with a real database, hashed passwords, and token-based login.

## What changed vs. the localStorage version

| Before | Now |
|---|---|
| Accounts + plaintext passwords in `localStorage` | Accounts in SQLite, passwords hashed with bcrypt, never stored or sent in plaintext |
| "Logged in" = a copy of `{name,email,role}` sitting in `localStorage` | "Logged in" = a signed JWT token, verified by the server on every request |
| Admin content (videos, programs, etc.) saved per-browser | Saved in the database — every visitor sees the same content |
| Views/likes/shares/comments counted per-browser | Counted on the server — real, shared counts |
| Contact messages / feedback / posts per-browser | Stored server-side; admin sees everything, members see their own |

## Setup

```bash
cd backend
npm install
cp .env.example .env
```

Open `.env` and set:
- `JWT_SECRET` — a long random string (the example command in the file generates one)
- `CORS_ORIGIN` — the URL(s) your frontend is served from
- `SEED_ADMIN_PASSWORD` — the admin account's initial password (change it after first login, from the Profile page)

Then run it:

```bash
npm start
```

You should see `Sikh Jagat API listening on http://localhost:8787`.
The database file is created automatically at `backend/data/sikhjagat.db`.

## Connecting the frontend

The frontend's `api.js` points at `http://localhost:8787/api` by default.
To point it somewhere else (e.g. a deployed server), set this **before**
`api.js` loads, e.g. add this line above `<script src="api.js">` in
`index.html`:

```html
<script>window.SIKHJAGAT_API_BASE = "https://your-api-domain.com/api";</script>
```

## Security notes

- Passwords are hashed with bcrypt (10 salt rounds) — never stored or
  logged in plaintext.
- Login/register/password-reset endpoints are rate-limited (20 requests
  per 15 minutes per IP) to slow down brute-force guessing.
- Login and "forgot password" always return the same generic error/response
  regardless of whether the account exists, so the endpoints can't be used
  to check which emails are registered.
- The admin role is never something a client can request — it's only ever
  set by the one-time seed script in `db.js`.
- `JWT_SECRET` must be kept secret and never committed to source control —
  anyone with it can forge valid login tokens.
- **Password reset codes**: this demo has no email/SMS provider wired up,
  so `POST /api/auth/forgot` returns the one-time code directly in the
  response (`demoOtp`) instead of sending it anywhere, exactly like the
  original localStorage-only demo did. Before putting this online for
  real, wire up a provider (e.g. SendGrid for email, Twilio for SMS), send
  the code through that instead, and delete the `demoOtp` field.
- CORS is restricted to the origins listed in `CORS_ORIGIN` — update this
  for your real frontend URL before deploying.

## What still lives in the browser's localStorage

Kept local intentionally, since it's either purely cosmetic per-device
state or lower-priority to migrate first: dark mode, language choice,
bookmarks, site notification/read-state, admin activity feed, and the
editable homepage/footer text (CMS). The backend already has working
endpoints for bookmarks (`/api/bookmarks`) and site text
(`/api/cms`) if you'd like to wire those up the same way the rest of the
app was — the pattern in `api.js`/`app.js` for content and messages is a
direct template to follow.

## API overview

- `POST /api/auth/register`, `/login`, `/forgot`, `/verify-otp`, `/reset-password`, `GET /me`
- `GET/PUT /api/users/me`, `PUT /api/users/me/password`, `GET /api/users` (admin)
- `GET/POST/PUT/DELETE /api/content/:type` — programs, services, resources, library, live, videos, photos, vlogs, podcasts, articles, playlists
- `GET /api/engagement/:type/:id`, `POST .../view`, `.../like`, `.../share`, `.../comments`, `DELETE .../comments/:id`
- `GET/POST /api/messages`, `POST /api/messages/:id/reply`, `DELETE /api/messages/:id`
- `GET/POST /api/feedback`, `GET/POST/DELETE /api/posts`
- `GET/POST /api/notifications`, `GET /api/admin-alerts`
- `GET/PUT /api/cms`, `GET/POST/DELETE /api/bookmarks`
