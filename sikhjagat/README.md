# Sikh Jagat — Plain HTML / CSS / JavaScript version (+ real backend)

No React, no build step, no npm install for the frontend. The site now
talks to a small Node.js/Express + SQLite backend instead of storing
everything in `localStorage` — see **`backend/README.md`** for setup.
Accounts and passwords are hashed and stored server-side, editable
content (videos, programs, etc.) and engagement (views/likes/comments)
are shared across every visitor, and messages/feedback/posts persist on
the server too.

## Quick start

```bash
# 1. Start the backend (in its own terminal)
cd backend
npm install
cp .env.example .env   # then edit JWT_SECRET, CORS_ORIGIN, SEED_ADMIN_PASSWORD
npm start              # → http://localhost:8787

# 2. Serve the frontend (in a second terminal, from the project root)
python3 -m http.server 8000
# → open http://localhost:8000
```

Sign in with the seed admin account you set in `backend/.env`
(`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`) to reach the Admin Dashboard,
and change that password from the Profile page right away.

If the backend isn't running, the site still loads and shows the
starter content from `data.js` (read-only) so you can preview the UI —
but login, admin edits, and engagement need the backend to be up.

## How to run it

Just open `index.html` in a browser... almost. A couple of features
(`localStorage` persistence loads fine, but the file:// protocol blocks
some things), so it's best to serve it locally:

**Option A — VS Code Live Server extension (easiest)**
1. Install the "Live Server" extension in VS Code
2. Right-click `index.html` → "Open with Live Server"

**Option B — Python (already on most machines)**
```bash
cd sikhjagat-vanilla
python3 -m http.server 8000
```
Then open `http://localhost:8000` in your browser.

## File structure — read them in this order

```
index.html    ← the page skeleton: header, footer, empty <main id="app">,
                 modal/toast containers. Nothing dynamic lives here — 
                 app.js fills it all in.
style.css     ← every visual style. Colors are CSS variables at the very
                 top (--color-primary, --color-bg, etc.) so re-theming
                 the whole site means editing ~10 lines, not hunting
                 through the whole file.
data.js       ← all the "content": programs, services, videos, articles,
                 library books, translated UI strings. To add a program,
                 copy one of the objects in the PROGRAMS array.
storage.js    ← 15 lines. Two functions, storageGet/storageSet, that
                 save/load JSON from the browser's localStorage.
app.js        ← the actual application. Organized top-to-bottom:
                 1. STATE           one object holding everything that changes
                 2. INIT             loads saved data when the page opens
                 3. HELPERS          t() for translations, toast(), bookmarks
                 4. HEADER/FOOTER    functions that redraw the nav & footer
                 5. PAGE RENDERERS   one function per page (pageHome(),
                                     pagePrograms(), etc.) — each just
                                     returns an HTML string
                 6. render()         the "redraw everything" function
                 7. EVENT HANDLING   ONE click listener for the whole app
                                     (see below)
                 8. FEATURE LOGIC    forms, admin dashboard, chatbot, QR
```

## How the "no framework" navigation works

There's no React, so there's no automatic re-rendering. Instead:

1. `state` (top of `app.js`) is one JavaScript object holding everything
   that can change — which page you're on, dark mode, your bookmarks, etc.
2. Every page is a function that takes the current `state` and returns an
   HTML string, e.g. `pagePrograms()` returns `"<div>...</div>"`.
3. `render()` picks the right page function and does
   `document.getElementById("app").innerHTML = fn()`
4. Clicking anything (`navigate('about')`, bookmarking, submitting a form)
   changes something in `state`, then calls `render()` again to redraw.

Because the whole `<main id="app">` is replaced on every render, there's
no need to manually attach a click listener to every single button —
instead there's **one** listener on the whole document (search for
`document.addEventListener("click", ...)` in `app.js`) that looks at
`data-page` / `data-action` attributes on whatever was clicked. This is
called **event delegation** and it's the standard way to handle dynamic
content without a framework.

## What's new: real YouTube playlists

- Admin can add a **YouTube playlist** — Admin Dashboard → 📺 YT Playlists —
  by pasting either the playlist link (`youtube.com/playlist?list=...`,
  or a video link with `&list=...` in it) or just the bare playlist ID.
  No API key needed: it uses YouTube's public embeddable player.
- Playlists show up in their own row at the top of the **Videos** page and
  open in the same detail popup as everything else — with the actual
  playlist playing inline — plus the same views/likes/shares/comments and
  bookmarking as every other content type.

## What's new: view counts, likes, shares & comments

- Every video, photo album, vlog, podcast episode and article now tracks
  real **views** (counted each time someone opens it), **likes** (❤️,
  works for guests too — no account required, one like per browser/account),
  **shares** (uses the native share sheet on mobile, or copies a link on
  desktop), and **comments** — all shown right in the item's detail popup,
  plus a compact summary on every card.
- Admin sees the same numbers everywhere content is listed in the Admin
  Dashboard, plus a **"🏆 Most viewed content"** leaderboard on the
  Overview tab so it's obvious what's resonating with the Sangat.
- New comments show up instantly for everyone and also drop a note in
  admin's **Recent activity** feed (see below) — admins signed in can
  also delete a comment.

## What's new: replying to messages, and knowing when something happens

- **Admin can now reply** to any message on the Contact page — each one
  in the Admin Dashboard's Messages tab has a reply box; once sent, the
  sender sees the reply on the Contact page (under "Your messages", if
  they're signed in with the same email) and gets a notification in the
  site's 🔔 bell.
- **Admin gets notified too.** A new "🔔 Recent activity" feed on the
  Overview tab (plus a red badge on the Admin link in the profile menu)
  surfaces new contact messages, new feedback, new sign-ups, and new
  comments as they happen — so nothing needs to be found by digging
  through tabs.

## What's new: admin now uploads everything

- **Admin Dashboard** (log in as `admin@sikhjagat.org` / `admin123`) now has a tab
  for every content type in the header: Live Classes, Videos, Photos, Vlogs,
  Podcasts, Articles, Library, Programs, Services and Resources — each with a
  simple "add new item" form and a delete button, exactly like the existing
  Community Posts tab. Photos supports a real image upload; everything else
  uses the same text fields already shown on the public pages.
- **Live Classes** has its own admin tab: add a class, and toggle the "LIVE now"
  status with one click (📡 button next to each item). Changes show up
  immediately on the Home and Live pages for every visitor.
- **"X online now"** is no longer shown in the public header — it's only
  visible to admins, at the top of the Admin Dashboard's Overview tab.
- Everything an admin adds/edits is saved to `localStorage` the same way the
  CMS text already was, so it persists across page reloads on that browser.

## What's new: a more professional login

- **Redesigned sign-in/sign-up modal**: a show/hide toggle on the password
  field, cleaner spacing, and a "Remember me" checkbox.
  - Checked (default): you stay signed in across visits, same as before
    (`localStorage`).
  - Unchecked: you stay signed in for that browser tab only — closing the
    browser signs you out (`sessionStorage`).
- **Forgot password?** on the sign-in form starts a 3-step reset:
  1. Enter the email or mobile number on your account.
  2. Enter the 6-digit one-time code.
  3. Choose a new password.
  There's no real email/SMS backend in this static demo (see the AI
  chatbot note below for the same limitation), so instead of pretending to
  send something, the code is shown directly in a toast notification —
  everything else about the flow (matching the account, a 5-minute
  expiry, checking the code) works the same as a real one would.
  Registering with a mobile number is optional; you can request the code
  by email instead.

## Known limitations

- **Login/Register** now uses the backend: passwords are hashed with
  bcrypt and never stored in plaintext, and sessions are a signed JWT
  token rather than a copy of your user object in `localStorage`. Sign
  in as the seed admin account (set in `backend/.env`) to reach the admin
  dashboard.
- **AI chatbot** needs the small `server.js` proxy (from the VS Code React
  project I gave you earlier) running on `localhost:8787` with your own
  Anthropic API key — otherwise it shows a friendly "can't reach server"
  message instead of crashing. (Note: that's a different port purpose
  than the new backend's `8787` — run them on different ports if you use
  both, and update `SIKHJAGAT_API_BASE`/the chatbot's URL accordingly.)
- **Multi-language**: 5 languages are fully translated (English, Punjabi,
  Hindi, Spanish, French) as a working example; the rest show in the
  language picker but fall back to English. Add more by copying a block
  in `data.js`'s `STRINGS` object.
- **QR codes** call a free public API (`api.qrserver.com`) — needs
  internet access to load.
- **Password reset codes**: there's no real email/SMS provider wired up
  yet, so the one-time code is returned directly by the API and shown in
  a toast instead of actually being sent — see `backend/README.md` for
  what to change before going live.
- **Still browser-local** (not yet migrated to the backend, see
  `backend/README.md`): dark mode, language choice, bookmarks,
  notification read-state, the admin activity feed, and the editable
  homepage/footer text.

## Quick recipes

**Change the accent color:** open `style.css`, edit `--color-primary` and
`--color-primary-dark` near the top of the file.

**Change fonts:** edit the Google Fonts `<link>` in `index.html`'s `<head>`,
and update `--font-display` / `--font-body` in `style.css`.

**Add a new program/video/article:** open `data.js`, copy an existing
object in the relevant array (`PROGRAMS`, `VIDEOS`, `ARTICLES`, etc.) and
edit the fields.

**Add a new page:** write a function `function pageFoo() { return \`<div
class="page-wrap">...</div>\`; }` in `app.js`, add `foo: pageFoo` to the
`PAGE_RENDERERS` object, and add a nav button with `data-page="foo"`
wherever you want it to link from.
