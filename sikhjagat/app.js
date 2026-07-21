/* =====================================================================
   APP.JS — all application logic. Uses plain DOM APIs (no framework).
   Structure:
     1. STATE           - one object holding everything that can change
     2. INIT             - load saved data from localStorage on page load
     3. HELPERS          - t() for translated strings, toast(), etc.
     4. HEADER / FOOTER  - functions that (re)draw the header & footer
     5. PAGE RENDERERS   - one function per page, returns an HTML string
     6. render()         - the "master" function: redraws everything
     7. EVENT HANDLING   - one delegated click listener for the whole app
     8. FEATURE LOGIC    - auth, bookmarks, admin, QR, notifications
   ===================================================================== */

/* --------------------------- 1. STATE --------------------------- */
const state = {
  page: "home",
  dark: false,
  lang: "en",
  user: null,            // { name, email, role } | null
  cms: { ...DEFAULT_CMS },
  visitorCount: 0,
  notifications: [],
  readNotifIds: [],
  notificationsEnabled: true,
  adminAlerts: [],        // internal "something happened" feed, admin-only (new messages/feedback/signups)
  readAdminAlertIds: [],
  engagement: {},         // { "video:v1": { views, likes:[whoLiked], shares, comments:[{id,name,text,time}] } }
  deviceId: null,         // anonymous per-browser id so guests (no account) can still like without duplicating
  feedbackList: [],
  contactMessages: [],
  users: [],
  bookmarks: [],          // [{ id, type, title }]
  libraryFilter: "All",   // used by the Library page's category filter
  videoView: "all",       // "all" | "videos" | "playlists" — filter on the Videos page
  search: "",             // current text in the header search box (not persisted)
  _searchTarget: null,    // { id, mediaType } of the last item a search result jumped to,
                           // so we can re-flash it if the media modal covering it lands on top of it
  posts: [],              // [{ id, image (data URL or null), caption, author, time }]
  activeUsers: 1,
  // Content that used to live only in data.js — now admin-editable & persisted.
  programs: [], services: [], resources: [], libraryItems: [], liveClasses: [],
  videos: [], photos: [], vlogs: [], podcasts: [], articles: [], playlists: [],
};

/* Config describing every admin-uploadable content list: which state key
   backs it, which localStorage key it's saved under, which fields the
   "add new" form shows, and how to summarize an item in the list view.
   This drives the generic admin content-manager tabs (see renderContentManagerTab). */
const CONTENT_TYPES = {
  live: {
    label: "Live Classes", icon: "📡", stateKey: "liveClasses", storageKey: "live-classes",
    fields: [
      ["title", "Class title"], ["host", "Host"], ["time", "Time (e.g. Today · 5:30 AM)"],
      ["linkType", "Stream type"],
      ["link", "Stream link (Google Meet / Zoom URL, or YouTube URL)"],
    ],
    hasLiveToggle: true,
    summary: (i) => `${i.title} — ${i.host} · ${i.time}`,
  },
  videos: {
    label: "Videos", icon: "🎥", stateKey: "videos", storageKey: "videos", mediaType: "video",
    fields: [["title", "Title"], ["cat", "Category"], ["dur", "Duration (e.g. 12:04)"], ["views", "Views (e.g. 1.2K)"], ["link", "Video link (YouTube URL — optional)"]],
    linkHint: "Optional. Paste a YouTube link and it plays inline for visitors; leave blank to keep the placeholder player.",
    summary: (i) => `${i.title} — ${i.cat}`,
  },
  photos: {
    label: "Photos", icon: "🖼️", stateKey: "photos", storageKey: "photos", mediaType: "photo",
    fields: [["title", "Album title"], ["count", "Photo count (e.g. 24 photos)"], ["link", "Full album link (optional)"]],
    hasImage: true,
    linkHint: "Optional. If the full album lives elsewhere (Google Photos, Facebook, etc.), visitors get a button to open it.",
    summary: (i) => i.title,
  },
  vlogs: {
    label: "Vlogs", icon: "🎬", stateKey: "vlogs", storageKey: "vlogs", mediaType: "vlog",
    fields: [["title", "Title"], ["author", "Author"], ["dur", "Duration (e.g. 9:40)"], ["link", "Video link (YouTube URL — optional)"]],
    linkHint: "Optional. Paste a YouTube link and it plays inline for visitors; leave blank to keep the placeholder player.",
    summary: (i) => `${i.title} — ${i.author}`,
  },
  podcasts: {
    label: "Podcasts", icon: "🎙️", stateKey: "podcasts", storageKey: "podcasts", mediaType: "podcast",
    fields: [["title", "Episode title"], ["guest", "Guest"], ["dur", "Duration (e.g. 41 min)"], ["link", "Listen link (optional)"]],
    linkHint: "Optional. Spotify, Apple Podcasts, YouTube — visitors get a button to open it and listen there.",
    summary: (i) => `${i.title} — ${i.guest}`,
  },
  articles: {
    label: "Articles", icon: "📰", stateKey: "articles", storageKey: "articles", mediaType: "article",
    fields: [["title", "Title"], ["author", "Author"], ["read", "Read time (e.g. 6 min read)"], ["link", "Full article link (optional)"]],
    linkHint: "Optional. If the full piece lives elsewhere, visitors get a button to read it there.",
    summary: (i) => `${i.title} — ${i.author}`,
  },
  playlists: {
    label: "YouTube Playlists", icon: "📺", stateKey: "playlists", storageKey: "playlists", mediaType: "playlist",
    fields: [["title", "Playlist title"], ["url", "YouTube playlist URL or ID"]],
    summary: (i) => i.title,
  },
  library: {
    label: "Library", icon: "📚", stateKey: "libraryItems", storageKey: "library-items",
    fields: [["title", "Title"], ["author", "Author"], ["cat", "Category"], ["link", "PDF / file link (optional — used if no file is dropped below)"]],
    hasFile: true,
    linkHint: "Optional. Paste a direct PDF or file link, or drop a PDF below — visitors get an Open/Download button on this item.",
    summary: (i) => `${i.title} — ${i.author}`,
  },
  programs: {
    label: "Programs", icon: "🎓", stateKey: "programs", storageKey: "programs",
    fields: [["title", "Title"], ["age", "Age group"], ["days", "Days / time"], ["icon", "Emoji icon"], ["desc", "Description"], ["link", "More info link (optional)"]],
    linkHint: "Optional. A registration form, WhatsApp group, or details page — visitors get a button to open it.",
    summary: (i) => i.title,
  },
  services: {
    label: "Services", icon: "🛠️", stateKey: "services", storageKey: "services",
    fields: [["title", "Title"], ["icon", "Emoji icon"], ["desc", "Description"], ["link", "More info / request link (optional)"]],
    linkHint: "Optional. A form or contact page — if set, \"Request this\" opens it directly.",
    summary: (i) => i.title,
  },
  resources: {
    label: "Resources", icon: "📄", stateKey: "resources", storageKey: "resources",
    fields: [["title", "Title"], ["type", "Type (PDF / Image)"], ["size", "File size (e.g. 2.1 MB — auto-filled if you drop a file)"], ["link", "File link (optional — used if no file is dropped below)"]],
    hasFile: true,
    linkHint: "Optional. Paste a direct file link, or drop a PDF below — the ⬇ button opens/downloads whichever is set.",
    summary: (i) => i.title,
  },
};

const NAV_MAIN = [
  { key: "home", icon: "🏠" }, { key: "about", icon: "ℹ️" }, { key: "programs", icon: "🎓" },
  { key: "services", icon: "🛠️" }, { key: "resources", icon: "📚" }, { key: "library", icon: "📖" },
  { key: "live", icon: "📡" },
];
const NAV_MEDIA = [
  { key: "videos", icon: "🎥" }, { key: "photos", icon: "🖼️" }, { key: "vlogs", icon: "🎬" },
  { key: "podcasts", icon: "🎙️" }, { key: "posts", icon: "📸" }, { key: "articles", icon: "📰" },
];
const NAV_END = [{ key: "faq", icon: "❓" }, { key: "contact", icon: "☎️" }, { key: "feedback", icon: "💬" }];

/* --------------------------- 2. INIT --------------------------- */
async function init() {
  state.dark = storageGet("dark-mode", false);
  state.lang = storageGet("language", "en");
  state.cms = { ...DEFAULT_CMS, ...storageGet("cms-content", {}) };
  state.notifications = storageGet("notifications", [
    { id: "seed1", title: "Welcome to Sikh Jagat", body: "Explore live classes, the library and our full program calendar.", time: "Just now" }
  ]);
  state.readNotifIds = storageGet("read-notifs", []);
  state.notificationsEnabled = storageGet("notifications-enabled", true);
  state.adminAlerts = storageGet("admin-alerts", []);
  state.readAdminAlertIds = storageGet("read-admin-alerts", []);
  state.engagement = storageGet("engagement", {});
  state.deviceId = storageGet("device-id", null);
  if (!state.deviceId) {
    state.deviceId = Math.random().toString(36).slice(2) + Date.now().toString(36);
    storageSet("device-id", state.deviceId);
  }
  state.feedbackList = (state.user && state.user.role === "admin") ? await api.getFeedback().catch(() => []) : [];
  state.contactMessages = await api.getMessages().catch(() => []);

  // Accounts and passwords now live on the backend (hashed, never in
  // localStorage). If a login token is already saved from a previous visit,
  // ask the server who it belongs to; an expired/invalid token just means
  // signed-out, same as never having logged in.
  state.user = await api.me();
  // Full account list is only needed (and only permitted) for the admin
  // dashboard's "Registered users" tab and stats.
  state.users = state.user && state.user.role === "admin" ? await api.listUsers().catch(() => []) : [];

  state.bookmarks = storageGet("bookmarks", []);
  state.posts = await api.getPosts().catch(() => []);

  // Editable content now lives on the backend too, so every visitor (not
  // just this browser) sees what the admin uploads. Falls back to the
  // starter content in data.js if the backend can't be reached, so the
  // site still works while you're setting up the server.
  const FALLBACKS = {
    programs: PROGRAMS, services: SERVICES, resources: RESOURCES,
    libraryItems: LIBRARY_ITEMS, liveClasses: LIVE_CLASSES, videos: VIDEOS,
    photos: PHOTOS, vlogs: VLOGS, podcasts: PODCASTS, articles: ARTICLES, playlists: [],
  };
  await Promise.all(Object.entries(CONTENT_TYPES).map(async ([typeKey, cfg]) => {
    try {
      state[cfg.stateKey] = await api.listContent(typeKey);
    } catch (e) {
      console.warn(`Couldn't reach the backend for "${typeKey}" — showing starter content instead.`, e);
      state[cfg.stateKey] = FALLBACKS[cfg.stateKey] || [];
    }
  }));
  await loadAllEngagement().catch(() => {});

  // visitor counter: bump by one every time the page loads
  state.visitorCount = storageGet("visitor-count", 18420) + 1;
  storageSet("visitor-count", state.visitorCount);

  document.documentElement.setAttribute("data-theme", state.dark ? "dark" : "light");
  applyLangNotice();
  bindStaticEvents();
  initPresence();
  render();
}


/* --------------------------- 3. HELPERS --------------------------- */
function t() { return STRINGS[state.lang] || STRINGS.en; }

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

/* ---- Rich text (used by the Community Posts caption editor) ----
   sanitizeRichHtml() keeps only the formatting the toolbar can produce
   (bold/italic/underline + font-family/size/color) and strips everything
   else — scripts, event-handler attributes, unknown tags — before an
   admin's post is saved to localStorage and shown to every visitor.
   stripHtml() gives the plain-text version, used for notification text. */
const RICH_TEXT_ALLOWED_TAGS = new Set(["B", "STRONG", "I", "EM", "U", "SPAN", "FONT", "BR", "DIV"]);
const RICH_TEXT_ALLOWED_STYLES = new Set(["color", "font-family", "font-size", "font-weight", "font-style", "text-decoration"]);

function sanitizeRichHtml(html) {
  const container = document.createElement("div");
  container.innerHTML = html ?? "";

  function clean(node) {
    [...node.childNodes].forEach((child) => {
      if (child.nodeType === Node.ELEMENT_NODE) {
        if (!RICH_TEXT_ALLOWED_TAGS.has(child.tagName)) {
          // unwrap disallowed elements instead of dropping their text
          while (child.firstChild) node.insertBefore(child.firstChild, child);
          node.removeChild(child);
          return;
        }
        [...child.attributes].forEach((attr) => {
          if (attr.name === "style") {
            const kept = attr.value.split(";").map((s) => s.trim()).filter((rule) => {
              const prop = rule.split(":")[0]?.trim().toLowerCase();
              return RICH_TEXT_ALLOWED_STYLES.has(prop);
            });
            if (kept.length) child.setAttribute("style", kept.join("; "));
            else child.removeAttribute("style");
          } else if (attr.name !== "size") {
            child.removeAttribute(attr.name);
          }
        });
        clean(child);
      } else if (child.nodeType !== Node.TEXT_NODE) {
        node.removeChild(child);
      }
    });
  }
  clean(container);
  return container.innerHTML;
}

function stripHtml(html) {
  const div = document.createElement("div");
  div.innerHTML = html ?? "";
  return (div.textContent || "").trim();
}

/* Reusable rich-text field: a toolbar (font / size / bold / italic / underline
   / color) wired to a specific contenteditable box via data-target="<id>", so
   any number of these can sit on screen at once (e.g. two on the CMS tab)
   without stepping on each other. Drop this in anywhere a plain textarea
   used to go — see admin-tab usages below (Community Posts caption, About
   us / hero text, Programs & Services descriptions, message replies). */
function richTextField(id, value, placeholder, rows = 3) {
  const minHeight = Math.max(60, rows * 22 + 20);
  return `
    <div class="rte-toolbar">
      <select class="rte-font-select" data-target="${id}" title="Font" onmousedown="event.preventDefault()">
        <option value="">Font</option>
        <option value="Inter, sans-serif">Inter</option>
        <option value="'Yatra One', cursive">Yatra One</option>
        <option value="Georgia, serif">Georgia</option>
        <option value="Arial, sans-serif">Arial</option>
        <option value="'Courier New', monospace">Courier New</option>
      </select>
      <select class="rte-size-select" data-target="${id}" title="Font size" onmousedown="event.preventDefault()">
        <option value="">Size</option>
        <option value="12">12</option>
        <option value="14">14</option>
        <option value="16">16</option>
        <option value="18">18</option>
        <option value="24">24</option>
        <option value="32">32</option>
      </select>
      <button type="button" class="rte-btn" data-action="rte-bold" data-target="${id}" title="Bold" onmousedown="event.preventDefault()"><b>B</b></button>
      <button type="button" class="rte-btn" data-action="rte-italic" data-target="${id}" title="Italic" onmousedown="event.preventDefault()"><i>I</i></button>
      <button type="button" class="rte-btn" data-action="rte-underline" data-target="${id}" title="Underline" onmousedown="event.preventDefault()"><u>U</u></button>
      <label class="rte-color-swatch" title="Font color" onmousedown="event.preventDefault()">
        🎨<input type="color" class="rte-color-input" data-target="${id}" value="#1a1a1a" />
      </label>
    </div>
    <div id="${id}" class="rte-editable" contenteditable="true" style="min-height:${minHeight}px;"
      data-placeholder="${escapeHtml(placeholder || "")}">${sanitizeRichHtml(value || "")}</div>`;
}

function toast(msg, kind = "info") {
  const stack = document.getElementById("toast-stack");
  const el = document.createElement("div");
  el.className = `toast ${kind}`;
  el.textContent = msg;
  stack.appendChild(el);
  setTimeout(() => el.remove(), 3800);
}

function isBookmarked(id) { return state.bookmarks.some((b) => b.id === id); }

function toggleBookmark(id, type, title) {
  if (isBookmarked(id)) {
    state.bookmarks = state.bookmarks.filter((b) => b.id !== id);
    toast("Removed from bookmarks");
  } else {
    state.bookmarks.push({ id, type, title });
    toast(`${t().saved}: ${title}`, "success");
  }
  storageSet("bookmarks", state.bookmarks);
  render(); // re-draw so bookmark icons + badge counts update
}

function applyLangNotice() {
  const notice = document.getElementById("lang-notice");
  if (state.lang !== "en" && !FULLY_TRANSLATED.includes(state.lang)) {
    notice.textContent = `Showing content in English — full translation for ${LANGUAGE_NAMES[state.lang]} is coming soon.`;
    notice.classList.remove("hidden");
  } else {
    notice.classList.add("hidden");
  }
}

/* Every searchable content list, with which state key it lives in, which
   fields to match against, which page it opens to, a short type label for
   the result badge, and (for media types) which openMediaModal type to use
   so a result can jump straight to the photo/video/etc it found. */
const SEARCH_SOURCES = [
  { stateKey: "programs", fields: ["title", "desc", "age"], page: "programs", label: "Program" },
  { stateKey: "services", fields: ["title", "desc"], page: "services", label: "Service" },
  { stateKey: "resources", fields: ["title", "type"], page: "resources", label: "Resource" },
  { stateKey: "libraryItems", fields: ["title", "author", "cat"], page: "library", label: "Library" },
  { stateKey: "liveClasses", fields: ["title", "host"], page: "live", label: "Live Class" },
  { stateKey: "videos", fields: ["title", "cat"], page: "videos", label: "Video", mediaType: "video" },
  { stateKey: "photos", fields: ["title"], page: "photos", label: "Photo", mediaType: "photo" },
  { stateKey: "vlogs", fields: ["title", "author"], page: "vlogs", label: "Vlog", mediaType: "vlog" },
  { stateKey: "podcasts", fields: ["title", "guest"], page: "podcasts", label: "Podcast", mediaType: "podcast" },
  { stateKey: "articles", fields: ["title", "author"], page: "articles", label: "Article", mediaType: "article" },
  { stateKey: "playlists", fields: ["title"], page: "videos", label: "Playlist", mediaType: "playlist" },
];

function getSearchResults(query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const results = [];
  SEARCH_SOURCES.forEach((src) => {
    (state[src.stateKey] || []).forEach((item) => {
      const hit = src.fields.some((f) => (item[f] || "").toString().toLowerCase().includes(q));
      if (hit) {
        results.push({
          id: item.id, title: item.title, page: src.page, label: src.label,
          mediaType: src.mediaType || null,
        });
      }
    });
  });
  return results.slice(0, 30);
}

function renderSearchMenu() {
  const resultsEl = document.getElementById("search-results");
  if (!resultsEl) return;
  const q = state.search || "";
  if (!q.trim()) {
    resultsEl.innerHTML = `<div class="search-empty-state">${t().searchHint}</div>`;
    return;
  }
  const results = getSearchResults(q);
  if (results.length === 0) {
    resultsEl.innerHTML = `<div class="search-empty-state">${t().noSearchResults} "${escapeHtml(q)}"</div>`;
    return;
  }
  resultsEl.innerHTML = results.map((r) => `
    <button class="dropdown-item search-result-item" data-action="search-goto" data-page="${r.page}" data-id="${r.id}" data-media-type="${r.mediaType || ""}">
      <span class="pill pill-navy">${r.label}</span>
      <span class="search-result-title">${escapeHtml(r.title)}</span>
    </button>
  `).join("");
}

/* --------------------------- 4. HEADER / FOOTER --------------------------- */
function renderHeader() {
  const nav = document.getElementById("main-nav");
  nav.innerHTML = [...NAV_MAIN, ...NAV_END].map(navBtnHtml).join("");

  document.getElementById("media-dropdown-slot").innerHTML = `
    <div class="dropdown" id="media-dropdown">
      <button class="nav-btn ${NAV_MEDIA.some(m => m.key === state.page) ? "active" : ""}" id="media-dropdown-btn">${t().media} ▾</button>
      <div class="dropdown-menu hidden" id="media-dropdown-menu">
        ${NAV_MEDIA.map((item) => `<button data-page="${item.key}">${item.icon} ${t()[item.key]}</button>`).join("")}
      </div>
    </div>
  `;

  document.getElementById("mobile-nav").innerHTML =
    [...NAV_MAIN, ...NAV_MEDIA, ...NAV_END].map(navBtnHtml).join("");

  renderLangMenu();
  renderNotifMenu();
  renderAuthArea();

  const searchInput = document.getElementById("search-input");
  if (searchInput) {
    searchInput.placeholder = t().searchPlaceholder;
    if (searchInput.value !== state.search) searchInput.value = state.search;
  }
  renderSearchMenu();

  document.getElementById("dark-toggle-btn").textContent = state.dark ? "☀️" : "🌙";
  document.getElementById("lang-code").textContent = state.lang.toUpperCase();

  const bmCount = document.getElementById("bookmark-count");
  bmCount.textContent = state.bookmarks.length;
  bmCount.classList.toggle("hidden", state.bookmarks.length === 0);

  const unread = state.notifications.filter((n) => !state.readNotifIds.includes(n.id)).length
    + (state.user && state.user.role === "admin" ? state.adminAlerts.filter((a) => !state.readAdminAlertIds.includes(a.id)).length : 0);
  const ncEl = document.getElementById("notif-count");
  ncEl.textContent = unread;
  ncEl.classList.toggle("hidden", unread === 0 || !state.notificationsEnabled);
  const notifIcon = document.getElementById("notif-icon");
  if (notifIcon) notifIcon.textContent = state.notificationsEnabled ? "🔔" : "🔕";
  document.getElementById("notif-btn").classList.toggle("muted", !state.notificationsEnabled);
}

function navBtnHtml(item) {
  const active = state.page === item.key ? "active" : "";
  return `<button class="nav-btn ${active}" data-page="${item.key}">${item.icon} ${t()[item.key]}</button>`;
}

function renderLangMenu() {
  const menu = document.getElementById("lang-menu");
  menu.innerHTML = `<div class="dropdown-label">100+ languages</div>` +
    Object.entries(LANGUAGE_NAMES).map(([code, name]) => `
      <button data-lang="${code}" style="${state.lang === code ? "color:var(--color-primary);font-weight:700" : ""}">
        <span>${name}</span>
        ${!FULLY_TRANSLATED.includes(code) ? `<span class="lang-auto-tag">auto</span>` : ""}
      </button>
    `).join("");
}

function renderNotifMenu() {
  const menu = document.getElementById("notif-menu");
  const isAdmin = state.user && state.user.role === "admin";
  const header = `
    <div class="dropdown-label notif-menu-header">
      <span>${t().notifications}</span>
      <button type="button" data-action="notif-toggle-enabled"
        class="notif-toggle ${state.notificationsEnabled ? "on" : "off"}"
        title="${state.notificationsEnabled ? "Turn notifications off" : "Turn notifications on"}">
        <span class="notif-toggle-knob"></span>
      </button>
    </div>`;

  const adminSection = !isAdmin ? "" : (
    `<div class="dropdown-label" style="font-weight:700;">📊 Admin alerts</div>` +
    (state.adminAlerts.length === 0
      ? `<div class="dropdown-label" style="padding:14px 16px;text-align:center;">Nothing yet — new requests, messages and sign-ups will show up here.</div>`
      : state.adminAlerts.slice().reverse().slice(0, 15).map((a) => `
        <div class="dropdown-item" style="display:block;">
          <p style="font-weight:700;font-size:13px;">${a.icon} ${escapeHtml(a.title)}</p>
          <p style="font-size:12px;color:var(--color-text-muted);margin-top:2px;">${escapeHtml(a.body)}</p>
          <p style="font-size:10px;color:var(--color-text-soft);margin-top:4px;">${escapeHtml(a.time)}</p>
        </div>
      `).join("")) +
    `<div class="dropdown-label" style="font-weight:700;">${t().notifications}</div>`
  );

  if (state.notifications.length === 0) {
    menu.innerHTML = header + adminSection + `<div class="dropdown-label" style="padding:20px 16px;text-align:center;">No notifications yet</div>`;
    return;
  }
  menu.innerHTML = header + adminSection +
    state.notifications.slice().reverse().map((n) => `
      <div class="dropdown-item" style="display:block;">
        <p style="font-weight:700;font-size:13px;">${escapeHtml(n.title)}</p>
        <p style="font-size:12px;color:var(--color-text-muted);margin-top:2px;">${escapeHtml(n.body)}</p>
        <p style="font-size:10px;color:var(--color-text-soft);margin-top:4px;">${escapeHtml(n.time)}</p>
      </div>
    `).join("");
}

function renderAuthArea() {
  const area = document.getElementById("auth-area");
  if (!state.user) {
    area.innerHTML = `<button class="btn btn-primary" id="open-auth-btn" style="padding:9px 16px;">👤 <span class="mobile-only-inline">${t().login}</span></button>`;
    return;
  }
  const unreadAlerts = state.adminAlerts.filter((a) => !state.readAdminAlertIds.includes(a.id)).length;
  area.innerHTML = `
    <div class="dropdown" id="profile-dropdown">
      <button class="icon-btn" id="profile-btn">
        <span class="user-avatar">${state.user.name.slice(0, 1).toUpperCase()}</span>
      </button>
      <div class="dropdown-menu hidden" id="profile-menu">
        <div style="padding:8px 16px;border-bottom:1px solid var(--color-border);margin-bottom:4px;">
          <p style="font-weight:700;font-size:13px;">${escapeHtml(state.user.name)}</p>
          <p style="font-size:11px;color:var(--color-text-muted);">${escapeHtml(state.user.email)}</p>
        </div>
        ${state.user.role === "admin" ? `<button data-page="admin" style="display:flex;align-items:center;justify-content:space-between;">📊 ${t().admin}${unreadAlerts > 0 ? `<span class="badge badge-red" style="position:static;">${unreadAlerts}</span>` : ""}</button>` : ""}
        <button data-page="profile">⚙️ My Profile</button>
        <button id="logout-btn" style="color:var(--color-error);">⏻ ${t().logOut}</button>
      </div>
    </div>
  `;
}

function renderFooter() {
  document.getElementById("footer-mission").textContent = state.cms.missionText;
  document.getElementById("footer-tag").textContent = t().footerTag;
  document.getElementById("visitor-count").textContent = state.visitorCount.toLocaleString();
  document.getElementById("footer-explore").innerHTML =
    ["about", "programs", "services", "library", "live"].map((k) => `<li><button data-page="${k}">${t()[k]}</button></li>`).join("");
  document.getElementById("footer-contact").innerHTML = `
    <li>📍 ${escapeHtml(state.cms.contactAddress)}</li>
    <li>☎️ ${escapeHtml(state.cms.contactPhone)}</li>
    <li>✉️ ${escapeHtml(state.cms.contactEmail)}</li>
  `;
  const waDigits = (state.cms.whatsappNumber || "").replace(/\D/g, "");
  const whatsappBtn = document.getElementById("whatsapp-btn");
  if (waDigits) {
    whatsappBtn.href = `https://wa.me/${waDigits}?text=${encodeURIComponent("Sat Sri Akal! I have a question for Sikh Jagat.")}`;
    whatsappBtn.classList.remove("hidden");
  } else {
    // No number set yet — hide the floating button rather than link nowhere.
    whatsappBtn.classList.add("hidden");
  }

  const legalEl = document.getElementById("footer-legal");
  if (legalEl) {
    legalEl.innerHTML = `
      <button data-page="faq">${t().faq}</button>
      <span class="footer-legal-dot">·</span>
      <button data-page="privacy">${t().privacy}</button>
    `;
  }
}

/* --------------------------- 5. PAGE RENDERERS --------------------------- */

function pageHome() {
  return `
    <section class="hero">
      <div class="hero-watermark">☬</div>
      <div class="hero-inner">
        <div class="hero-content">
          <div class="eyebrow">☬ Ik Onkar</div>
          <h1 class="hero-title">${escapeHtml(state.cms.heroTitle)}</h1>
          <p class="hero-sub rich-text">${state.cms.heroSub}</p>
          <div class="hero-actions">
            <button class="btn btn-primary" data-page="programs">${t().heroCta} →</button>
            <button class="btn btn-outline" data-page="live">📡 ${t().heroCta2}</button>
          </div>
          <div class="hero-stats">
            ${[["12K+","Sangat members"],["120+","Weekly classes"],["45","Countries reached"]].map(([n,l]) => `
              <div><p class="stat-num">${n}</p><p class="stat-label">${l}</p></div>
            `).join("")}
          </div>
        </div>
      </div>
    </section>

    <section class="page-wrap">
      <div class="section-header">
        <div class="eyebrow">☬ This week</div>
        <h2 class="section-title">Live &amp; upcoming classes</h2>
        <p class="section-sub">Join from anywhere — every session is streamed and recorded for the Library.</p>
      </div>
      <div class="grid grid-4">
        ${state.liveClasses.slice().reverse().map((c) => `
          <div class="card card-pad">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
              <span class="pill ${c.live ? "pill-live" : "pill-navy"}">${c.live ? "● LIVE" : "Upcoming"}</span>
              <button data-action="bookmark" data-id="${c.id}" data-type="class" data-title="${escapeHtml(c.title)}" class="bookmark-icon ${isBookmarked(c.id) ? "is-marked" : ""}">🔖</button>
            </div>
            <p style="font-weight:700;font-size:14px;margin-bottom:4px;">${escapeHtml(c.title)}</p>
            <p style="font-size:12px;color:var(--color-text-muted);margin-bottom:4px;">${escapeHtml(c.host)}</p>
            <p style="font-size:12px;color:var(--color-text-soft);">🕐 ${escapeHtml(c.time)}</p>
            <button class="btn btn-ghost" data-page="live" style="margin-top:10px;padding:0;">${t().joinClass} ›</button>
          </div>
        `).join("")}
      </div>
    </section>

    <section class="section-band">
      <div class="page-wrap" style="padding-top:0;padding-bottom:0;">
        <div class="section-header">
          <div class="eyebrow">☬ Learn</div>
          <h2 class="section-title">Featured programs</h2>
          <p class="section-sub">Structured, seva-run classes for every age.</p>
        </div>
        <div class="grid grid-3">
          ${state.programs.slice().reverse().slice(0, 3).map((p) => `
            <div class="card card-pad">
              <div class="icon-circle">${p.icon}</div>
              <p style="font-weight:700;margin-bottom:4px;">${escapeHtml(p.title)}</p>
              <p class="rich-text" style="font-size:13px;color:var(--color-text-muted);margin-bottom:10px;">${p.desc}</p>
              <span class="pill pill-saffron">${escapeHtml(p.age)}</span>
            </div>
          `).join("")}
        </div>
        <div style="text-align:center;margin-top:28px;">
          <button class="btn btn-outline" data-page="programs">View all programs →</button>
        </div>
      </div>
    </section>

    <section class="page-wrap">
      <div class="section-header">
        <div class="eyebrow">☬ Watch &amp; listen</div>
        <h2 class="section-title">From the archive</h2>
        <p class="section-sub">Kirtan, Katha, tutorials and stories from the Sangat.</p>
      </div>
      <div class="grid grid-3">
        ${state.videos.slice().reverse().slice(0, 3).map((v) => `
          <div class="card" style="overflow:hidden;cursor:pointer;" data-action="open-media" data-type="video" data-id="${v.id}">
            <div class="thumb">▶<span class="thumb-duration">${v.dur}</span></div>
            <div class="card-pad" style="padding:16px;">
              <p style="font-weight:600;font-size:13px;margin-bottom:4px;">${escapeHtml(v.title)}</p>
              <p style="font-size:12px;color:var(--color-text-muted);">👁 ${v.views} views · ${v.cat}</p>
            </div>
          </div>
        `).join("")}
      </div>
    </section>
  `;
}

function pageAbout() {
  const timeline = [["2012","Founded as a Sunday Gurmukhi circle"],["2018","First Kirtan &amp; Tabla program launched"],
    ["2021","Went fully online during the pandemic"],["2026","12,000+ Sangat members across 45 countries"]];
  const cards = [["👥","Sangat-run","Every program is organized and taught by community volunteers."],
    ["❤️","Free, always","Sustained entirely by donations and seva — never a paywall."],
    ["🌐","Open to all","New to Sikhi or born into it — everyone is welcome here."]];
  return `
    <div class="page-wrap medium">
      <div class="section-header">
        <div class="eyebrow">☬ About us</div>
        <h2 class="section-title">Our story &amp; mission</h2>
      </div>
      <div class="grid about-grid">
        <div>
          <p class="rich-text" style="color:var(--color-text-muted);line-height:1.7;">${state.cms.aboutText}</p>
          <div style="background:var(--color-primary-light);border-left:4px solid var(--color-primary);border-radius:0 12px 12px 0;padding:18px;margin-top:20px;">
            <p style="font-weight:700;margin-bottom:4px;">Our mission</p>
            <p style="font-size:14px;">${escapeHtml(state.cms.missionText)}</p>
          </div>
        </div>
        <div>
          ${timeline.map(([y,d]) => `<div class="timeline-item"><div class="timeline-year">${y}</div><p style="font-size:13px;color:var(--color-text-muted);">${d}</p></div>`).join("")}
        </div>
      </div>
      <div class="grid grid-3" style="margin-top:50px;">
        ${cards.map(([icon,title,desc]) => `
          <div class="card card-pad" style="text-align:center;">
            <div style="font-size:28px;margin-bottom:10px;">${icon}</div>
            <p style="font-weight:700;margin-bottom:4px;">${title}</p>
            <p style="font-size:13px;color:var(--color-text-muted);">${desc}</p>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

function pagePrograms() {
  return `
    <div class="page-wrap">
      <div class="section-header">
        <div class="eyebrow">☬ Learn</div>
        <h2 class="section-title">${t().programs}</h2>
        <p class="section-sub">Structured classes run entirely as seva by trained volunteers.</p>
      </div>
      <div class="grid grid-3">
        ${state.programs.slice().reverse().map((p) => `
          <div class="card card-pad" data-search-id="${p.id}">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;">
              <div class="icon-circle">${p.icon}</div>
              <button data-action="bookmark" data-id="${p.id}" data-type="program" data-title="${escapeHtml(p.title)}" class="bookmark-icon ${isBookmarked(p.id) ? "is-marked" : ""}">🔖</button>
            </div>
            <p style="font-weight:700;margin-bottom:4px;">${escapeHtml(p.title)}</p>
            <p class="rich-text" style="font-size:13px;color:var(--color-text-muted);margin-bottom:14px;">${p.desc}</p>
            <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--color-text-soft);border-top:1px solid var(--color-border);padding-top:10px;">
              <span>👥 ${p.age}</span><span>📅 ${p.days}</span>
            </div>
            ${p.link ? `<button class="btn btn-ghost" data-action="open-link" data-link="${escapeHtml(p.link)}" style="padding:0;margin-top:10px;">Learn more ›</button>` : ""}
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

function pageServices() {
  return `
    <div class="page-wrap">
      <div class="section-header">
        <div class="eyebrow">☬ Community</div>
        <h2 class="section-title">${t().services}</h2>
        <p class="section-sub">Practical support for the Sangat, at every stage of life.</p>
      </div>
      <div class="grid grid-3">
        ${state.services.slice().reverse().map((s) => `
          <div class="card card-pad" data-search-id="${s.id}">
            <div class="icon-circle" style="background:var(--color-primary-light);">${s.icon}</div>
            <p style="font-weight:700;margin-bottom:4px;">${escapeHtml(s.title)}</p>
            <p class="rich-text" style="font-size:13px;color:var(--color-text-muted);margin-bottom:14px;">${s.desc}</p>
            <button class="btn btn-ghost" style="padding:0;" data-action="request-service" data-id="${s.id}" data-title="${escapeHtml(s.title)}">Request this ›</button>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

function pageResources() {
  return `
    <div class="page-wrap narrow">
      <div class="section-header">
        <div class="eyebrow">☬ Downloads</div>
        <h2 class="section-title">${t().resources}</h2>
        <p class="section-sub">Free Gutkas, guides and printables for home and Gurdwara use.</p>
      </div>
      ${state.resources.slice().reverse().map((r) => `
        <div class="card" data-search-id="${r.id}" style="padding:16px;display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px;">
          <div style="display:flex;align-items:center;gap:12px;min-width:0;">
            <div style="width:40px;height:40px;border-radius:10px;background:var(--color-bg-soft);display:flex;align-items:center;justify-content:center;flex-shrink:0;">📄</div>
            <div style="min-width:0;">
              <p style="font-weight:600;font-size:14px;">${escapeHtml(r.title)}</p>
              <p style="font-size:12px;color:var(--color-text-soft);">${r.type} · ${r.size}</p>
            </div>
          </div>
          <button class="btn btn-outline" data-action="download-resource" data-id="${r.id}" data-title="${escapeHtml(r.title)}" style="padding:9px 12px;">⬇</button>
        </div>
      `).join("")}
    </div>
  `;
}

function pageLibrary() {
  const cats = ["All", ...new Set(state.libraryItems.map((i) => i.cat))];
  const sortedLibrary = state.libraryItems.slice().reverse();
  const filtered = state.libraryFilter === "All" ? sortedLibrary : sortedLibrary.filter((i) => i.cat === state.libraryFilter);
  return `
    <div class="page-wrap medium">
      <div class="section-header">
        <div class="eyebrow">☬ Read</div>
        <h2 class="section-title">${t().library}</h2>
        <p class="section-sub">A growing digital shelf of Sikh scripture, history and scholarship.</p>
      </div>
      <div class="category-filter">
        ${cats.map((c) => `<button data-action="lib-filter" data-cat="${c}" class="${state.libraryFilter === c ? "active" : ""}">${c}</button>`).join("")}
      </div>
      <div class="grid grid-2">
        ${filtered.map((l) => `
          <div class="card" data-search-id="${l.id}" style="padding:18px;display:flex;align-items:center;gap:14px;">
            <div style="width:48px;height:64px;border-radius:6px;background:linear-gradient(to bottom,#fb923c,#be123c);flex-shrink:0;display:flex;align-items:center;justify-content:center;color:white;">📖</div>
            <div style="flex:1;min-width:0;">
              <p style="font-weight:600;font-size:14px;">${escapeHtml(l.title)}</p>
              <p style="font-size:12px;color:var(--color-text-muted);margin:2px 0 6px;">${escapeHtml(l.author)}</p>
              <span class="pill pill-navy">${l.cat}</span>
            </div>
            <button data-action="bookmark" data-id="${l.id}" data-type="book" data-title="${escapeHtml(l.title)}" class="bookmark-icon ${isBookmarked(l.id) ? "is-marked" : ""}" style="flex-shrink:0">🔖</button>
            ${l.link ? `<button class="btn btn-outline" data-action="open-link" data-link="${escapeHtml(l.link)}" style="flex-shrink:0;padding:8px 10px;" title="Open / download">⬇</button>` : ""}
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

function pageLive() {
  return `
    <div class="page-wrap medium">
      <div class="section-header">
        <div class="eyebrow">☬ Right now</div>
        <h2 class="section-title">${t().live}</h2>
        <p class="section-sub">Streamed live and archived to the Library afterwards.</p>
      </div>
      <div class="grid grid-2">
        ${state.liveClasses.slice().reverse().map((c) => `
          <div class="card" data-search-id="${c.id}" style="overflow:hidden;">
            <div class="thumb" style="height:120px;background:${c.live ? "linear-gradient(135deg,#be123c,#ea580c)" : "linear-gradient(135deg,#334155,#0f172a)"};">
              📡
              ${c.live ? `<span class="thumb-live-badge"><span class="pulse-dot"></span> LIVE NOW</span>` : ""}
            </div>
            <div class="card-pad">
              <p style="font-weight:700;margin-bottom:4px;">${escapeHtml(c.title)}</p>
              <p style="font-size:13px;color:var(--color-text-muted);margin-bottom:4px;">${escapeHtml(c.host)}</p>
              <p style="font-size:12px;color:var(--color-text-soft);margin-bottom:14px;">🕐 ${escapeHtml(c.time)}</p>
              <button class="btn btn-primary btn-block" data-action="${c.live ? "watch-live" : "notify-me"}" data-id="${c.id}" data-title="${escapeHtml(c.title)}">
                ${c.live ? `📡 ${t().watchNow}` : "🔔 Notify me"}
              </button>
            </div>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

function pageVideos() {
  const view = state.videoView || "all";
  const showPlaylists = state.playlists.length > 0 && (view === "all" || view === "playlists");
  const showVideos = view === "all" || view === "videos";
  return `
    <div class="page-wrap">
      <div class="section-header">
        <div class="eyebrow">☬ Watch</div>
        <h2 class="section-title">${t().videos}</h2>
        <p class="section-sub">Kirtan, tutorials, history and Langar recipes.</p>
      </div>
      ${state.playlists.length > 0 ? `
        <div class="category-filter">
          <button data-action="video-view" data-view="all" class="${view === "all" ? "active" : ""}">All</button>
          <button data-action="video-view" data-view="videos" class="${view === "videos" ? "active" : ""}">🎥 Videos</button>
          <button data-action="video-view" data-view="playlists" class="${view === "playlists" ? "active" : ""}">📺 Playlists</button>
        </div>
      ` : ""}
      ${showPlaylists ? `
        <p style="font-weight:700;margin-bottom:12px;">📺 Playlists from YouTube</p>
        <div class="grid grid-3" style="margin-bottom:32px;">
          ${state.playlists.slice().reverse().map((p) => `
            <div class="card" data-search-id="${p.id}" style="overflow:hidden;">
              <div class="thumb" data-action="open-media" data-type="playlist" data-id="${p.id}" style="cursor:pointer;background:linear-gradient(135deg,#dc2626,#7f1d1d);">▶<span class="thumb-duration">📺 Playlist</span></div>
              <div class="card-pad" style="padding:16px;display:flex;justify-content:space-between;gap:8px;">
                <div style="min-width:0;">
                  <p style="font-weight:600;font-size:13px;margin-bottom:4px;">${escapeHtml(p.title)}</p>
                  <p style="font-size:11px;color:var(--color-text-soft);">${engMini("playlist", p.id)}</p>
                </div>
                <button data-action="bookmark" data-id="${p.id}" data-type="playlist" data-title="${escapeHtml(p.title)}" class="bookmark-icon ${isBookmarked(p.id) ? "is-marked" : ""}" style="flex-shrink:0">🔖</button>
              </div>
            </div>
          `).join("")}
        </div>
      ` : ""}
      ${showVideos ? `
        ${state.playlists.length > 0 ? `<p style="font-weight:700;margin-bottom:12px;">🎥 Individual videos</p>` : ""}
        <div class="grid grid-3">
          ${state.videos.slice().reverse().map((v) => `
            <div class="card" data-search-id="${v.id}" style="overflow:hidden;">
              <div class="thumb" data-action="open-media" data-type="video" data-id="${v.id}" style="cursor:pointer;">▶<span class="thumb-duration">${v.dur}</span></div>
              <div class="card-pad" style="padding:16px;display:flex;justify-content:space-between;gap:8px;">
                <div style="min-width:0;">
                  <p style="font-weight:600;font-size:13px;margin-bottom:4px;">${escapeHtml(v.title)}</p>
                  <p style="font-size:12px;color:var(--color-text-muted);">👁 ${v.views} · ${v.cat}</p>
                  <p style="font-size:11px;color:var(--color-text-soft);margin-top:2px;">❤️ ${peekEng("video", v.id).likeCount} · 💬 ${peekEng("video", v.id).comments.length}</p>
                </div>
                <button data-action="bookmark" data-id="${v.id}" data-type="video" data-title="${escapeHtml(v.title)}" class="bookmark-icon ${isBookmarked(v.id) ? "is-marked" : ""}" style="flex-shrink:0">🔖</button>
              </div>
            </div>
          `).join("")}
        </div>
      ` : ""}
      ${view === "playlists" && state.playlists.length === 0 ? `<div class="empty-state"><p>No playlists added yet</p></div>` : ""}
    </div>
  `;
}

function pagePhotos() {
  const grads = ["#fb923c,#be123c","#f43f5e,#7e22ce","#fbbf24,#c2410c","#14b8a6,#0f172a","#facc15,#be123c","#475569,#0f172a"];
  return `
    <div class="page-wrap">
      <div class="section-header">
        <div class="eyebrow">☬ Gallery</div>
        <h2 class="section-title">${t().photos}</h2>
        <p class="section-sub">Moments from Sangat life, Sewa and celebration.</p>
      </div>
      <div class="grid grid-3">
        ${state.photos.slice().reverse().map((p, i) => `
          <div class="card" data-search-id="${p.id}" style="overflow:hidden;cursor:pointer;" data-action="open-media" data-type="photo" data-id="${p.id}">
            <div class="thumb" style="height:190px;${p.image ? `background-image:url('${p.image}');background-size:cover;background-position:center;` : `background:linear-gradient(135deg,${grads[i % grads.length]});`}">
              ${p.image ? "" : "🖼️"}<span class="thumb-duration">${p.count}</span>
            </div>
            <div class="card-pad" style="padding:16px;"><p style="font-weight:600;font-size:13px;">${escapeHtml(p.title)}</p><p style="font-size:11px;color:var(--color-text-soft);margin-top:4px;">${engMini("photo", p.id)}</p></div>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

function pageVlogs() {
  return `
    <div class="page-wrap medium">
      <div class="section-header">
        <div class="eyebrow">☬ Behind the scenes</div>
        <h2 class="section-title">${t().vlogs}</h2>
        <p class="section-sub">Personal stories from our Sangat and youth wing.</p>
      </div>
      <div class="grid grid-2">
        ${state.vlogs.slice().reverse().map((v) => `
          <div class="card" data-search-id="${v.id}" style="padding:18px;display:flex;gap:14px;align-items:center;cursor:pointer;" data-action="open-media" data-type="vlog" data-id="${v.id}">
            <div style="width:96px;height:64px;border-radius:10px;background:linear-gradient(135deg,#be123c,#ea580c);flex-shrink:0;display:flex;align-items:center;justify-content:center;color:white;font-size:20px;">🎬</div>
            <div style="min-width:0;">
              <p style="font-weight:600;font-size:14px;">${escapeHtml(v.title)}</p>
              <p style="font-size:12px;color:var(--color-text-muted);margin-top:4px;">${escapeHtml(v.author)} · ${v.dur}</p>
              <p style="font-size:11px;color:var(--color-text-soft);margin-top:2px;">${engMini("vlog", v.id)}</p>
            </div>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

function pagePodcasts() {
  return `
    <div class="page-wrap narrow">
      <div class="section-header">
        <div class="eyebrow">☬ Listen</div>
        <h2 class="section-title">${t().podcasts}</h2>
        <p class="section-sub">Long-form conversations on Sikhi, identity and community.</p>
      </div>
      ${state.podcasts.slice().reverse().map((p) => `
        <div class="card" data-search-id="${p.id}" style="padding:18px;display:flex;align-items:center;gap:14px;margin-bottom:14px;">
          <button data-action="open-media" data-type="podcast" data-id="${p.id}" style="width:48px;height:48px;border-radius:50%;background:var(--color-primary);color:white;flex-shrink:0;font-size:16px;">▶</button>
          <div style="flex:1;min-width:0;">
            <p style="font-weight:600;font-size:14px;">${escapeHtml(p.title)}</p>
            <p style="font-size:12px;color:var(--color-text-muted);margin-top:4px;">${escapeHtml(p.guest)} · ${p.dur}</p>
            <p style="font-size:11px;color:var(--color-text-soft);margin-top:2px;">${engMini("podcast", p.id)}</p>
          </div>
        </div>
      `).join("")}
    </div>
  `;
}

function pageArticles() {
  return `
    <div class="page-wrap narrow">
      <div class="section-header">
        <div class="eyebrow">☬ Read</div>
        <h2 class="section-title">${t().articles}</h2>
        <p class="section-sub">Reflections and explainers from our editorial team and guest writers.</p>
      </div>
      ${state.articles.slice().reverse().map((a) => `
        <div class="card card-pad" data-search-id="${a.id}" style="margin-bottom:14px;">
          <div style="display:flex;justify-content:space-between;gap:12px;">
            <div>
              <p class="font-display" style="font-size:18px;font-weight:700;margin-bottom:6px;">${escapeHtml(a.title)}</p>
              <p style="font-size:12px;color:var(--color-text-soft);">${escapeHtml(a.author)} · ${a.read}</p>
              <p style="font-size:11px;color:var(--color-text-soft);margin-top:4px;">${engMini("article", a.id)}</p>
            </div>
            <button data-action="bookmark" data-id="${a.id}" data-type="article" data-title="${escapeHtml(a.title)}" class="bookmark-icon ${isBookmarked(a.id) ? "is-marked" : ""}" style="flex-shrink:0">🔖</button>
          </div>
          <button class="btn btn-ghost" data-action="open-media" data-type="article" data-id="${a.id}" style="padding:0;margin-top:10px;">${t().readMore} ›</button>
        </div>
      `).join("")}
    </div>
  `;
}

function pageContact() {
  const myMessages = state.user ? state.contactMessages.filter((m) => m.email.toLowerCase() === state.user.email.toLowerCase()) : [];
  return `
    <div class="page-wrap">
      <div class="section-header">
        <div class="eyebrow">☬ Reach out</div>
        <h2 class="section-title">${t().contact}</h2>
        <p class="section-sub">Questions about programs, seva, or anything else — we'd love to hear from you.</p>
      </div>
      ${myMessages.length > 0 ? `
        <div class="card card-pad" style="margin-bottom:20px;">
          <p style="font-weight:700;margin-bottom:12px;">💬 Your messages</p>
          ${myMessages.slice().reverse().map((m) => `
            <div class="list-row" style="display:block;">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
                <p style="font-size:13px;flex:1;">${escapeHtml(m.message)}</p>
                <button data-action="delete-message" data-id="${m.id}" title="Delete message" style="background:none;border:none;cursor:pointer;color:var(--color-error);font-size:14px;padding:0;flex-shrink:0;">🗑</button>
              </div>
              <p style="font-size:10px;color:var(--color-text-soft);margin-top:2px;">${escapeHtml(m.time)}</p>
              ${m.reply ? `
                <div style="margin-top:8px;padding:8px 10px;border-radius:8px;background:var(--color-bg-soft);border-left:3px solid var(--color-primary);">
                  <p style="font-size:11px;font-weight:700;color:var(--color-primary);">↩ Reply from Sikh Jagat <span style="font-weight:400;color:var(--color-text-soft);">· ${escapeHtml(m.reply_time)}</span></p>
                  <p class="rich-text" style="font-size:13px;margin-top:2px;">${m.reply}</p>
                </div>` : `<p style="font-size:11px;color:var(--color-text-soft);margin-top:6px;">⏳ Awaiting a reply from our team</p>`}
            </div>`).join("")}
        </div>` : ""}
      <div class="grid contact-grid">
        <div class="card card-pad">
          <form id="contact-form">
            <div class="two-col">
              <div class="field"><label>${t().yourName}</label><input id="contact-name" placeholder="Jasleen Kaur" value="${state.user ? escapeHtml(state.user.name) : ""}" /></div>
              <div class="field"><label>${t().yourEmail}</label><input id="contact-email" type="email" placeholder="you@example.com" value="${state.user ? escapeHtml(state.user.email) : ""}" /></div>
            </div>
            <div class="field"><label>${t().yourMsg}</label><textarea id="contact-message" rows="5" placeholder="How can we help?"></textarea></div>
            <button type="submit" class="btn btn-primary">➤ ${t().sendMsg}</button>
          </form>
        </div>
        <div>
          ${[["📍","Address",state.cms.contactAddress],["☎️","Phone",state.cms.contactPhone],["✉️","Email",state.cms.contactEmail]].map(([icon,label,val]) => `
            <div class="card" style="padding:18px;display:flex;gap:12px;margin-bottom:14px;">
              <div class="icon-circle" style="margin-bottom:0;flex-shrink:0;">${icon}</div>
              <div><p style="font-size:11px;font-weight:700;color:var(--color-text-soft);text-transform:uppercase;">${label}</p><p style="font-size:14px;margin-top:2px;">${escapeHtml(val)}</p></div>
            </div>
          `).join("")}
        </div>
      </div>
    </div>
  `;
}

function pageFeedback() {
  return `
    <div class="page-wrap narrow" style="text-align:center;">
      <div class="section-header center">
        <div class="eyebrow">☬ Your voice</div>
        <h2 class="section-title">${t().feedback}</h2>
        <p class="section-sub">Help us improve Sikh Jagat for the whole Sangat.</p>
      </div>
      <div class="card card-pad" style="text-align:left;max-width:480px;margin:0 auto;">
        <p style="font-weight:600;font-size:13px;text-align:center;margin-bottom:10px;">How was your experience?</p>
        <div class="star-row" id="feedback-stars">
          ${[1,2,3,4,5].map((n) => `<button data-star="${n}">★</button>`).join("")}
        </div>
        <div class="field">
          <label>Category</label>
          <select id="feedback-category">
            ${["General","Programs","Website","Live Classes","Library","Other"].map((c) => `<option>${c}</option>`).join("")}
          </select>
        </div>
        <div class="field"><label>Comments (optional)</label><textarea id="feedback-text" rows="4" placeholder="Tell us more..."></textarea></div>
        <button class="btn btn-primary btn-block" id="feedback-submit-btn">➤ ${t().submit}</button>
      </div>
    </div>
  `;
}

function pageFAQ() {
  const faqs = [
    { q: "What is Sikh Jagat?", a: "Sikh Jagat is a Sikh community and learning platform offering Gurmukhi classes, Kirtan, Sikh history education, Langar seva coordination, live classes, and a resource library — open to the whole Sangat, anywhere in the world." },
    { q: "Are the programs free to join?", a: "Most of our programs and classes are offered as seva (selfless service) and are free to attend. Some special workshops may mention a suggested donation on their program page — check the Programs section for details." },
    { q: "How do I join a live class?", a: "Go to the Live Classes page from the main menu. Upcoming and ongoing sessions are listed there with a \"Join class\" button that becomes active once the class starts." },
    { q: "Do I need to create an account to use the site?", a: "You can browse programs, videos, articles and the library without an account. Creating a free account lets you bookmark content, receive notifications, and submit feedback under your name." },
    { q: "How do I access the resource library?", a: "The Library page lists books and resources by category. Use the category filter at the top to narrow down what you're looking for." },
    { q: "Can I volunteer or do seva with Sikh Jagat?", a: "Yes! Reach out through the Contact page with your area of interest — teaching, media, event support, or Langar — and our team will follow up." },
    { q: "How is my data used or stored?", a: "We only store what's needed to run the site (like your bookmarks and preferences), and never share it with third parties. See our Privacy Policy for full details." },
    { q: "I found a bug or have a suggestion — where do I send it?", a: "Please use the Feedback page. Star ratings, category and comments all help us prioritize fixes and new features." },
  ];
  return `
    <div class="page-wrap narrow">
      <div class="section-header center">
        <div class="eyebrow">☬ Help</div>
        <h2 class="section-title">Frequently Asked Questions</h2>
        <p class="section-sub">Answers to common questions about Sikh Jagat's programs, classes, and platform.</p>
      </div>
      <div class="faq-list">
        ${faqs.map((f, i) => `
          <details class="faq-item" ${i === 0 ? "open" : ""}>
            <summary>${escapeHtml(f.q)}</summary>
            <p>${escapeHtml(f.a)}</p>
          </details>
        `).join("")}
      </div>
      <div class="card card-pad" style="text-align:center;margin-top:24px;">
        <p style="font-weight:600;margin-bottom:10px;">Still have a question?</p>
        <button class="btn btn-primary" data-page="contact">✉️ ${t().contact}</button>
      </div>
    </div>
  `;
}

function pagePrivacy() {
  const sections = [
    { h: "Introduction", p: "Sikh Jagat (\"we\", \"us\", \"our\") respects your privacy. This Privacy Policy explains what information we collect when you use this site, how we use it, and the choices you have. By using Sikh Jagat, you agree to the practices described here." },
    { h: "Information We Collect", p: "When you create an account we store your name, email address, and password. When you bookmark content, submit feedback, or send us a message through the Contact page, that content is stored so we can respond to you or show it back to you later. We do not knowingly collect information from children without a parent or guardian's involvement." },
    { h: "How We Use Your Information", p: "We use the information you provide to run core features of the site: signing you in, remembering your bookmarks and preferences, sending you relevant notifications, and responding to feedback or contact messages. We do not sell your personal information to third parties." },
    { h: "Local Storage & Cookies", p: "This site stores your preferences (such as dark mode, language, bookmarks, and login session) in your browser's local storage so the site remembers you between visits. Clearing your browser data will remove this information from your device." },
    { h: "Third-Party Services", p: "Some features rely on third-party services to work — for example, our QR code generator calls a public QR-generation API, and message links open WhatsApp. These services operate under their own privacy policies, which we encourage you to review." },
    { h: "Data Security", p: "We take reasonable measures to protect the information you share with us. However, no method of storage or transmission over the internet is 100% secure, and we cannot guarantee absolute security." },
    { h: "Your Choices", p: "You can update or delete your bookmarks at any time from the Bookmarks page, change your language and theme preferences from the header, and contact us to request that your account information be removed." },
    { h: "Changes to This Policy", p: "We may update this Privacy Policy from time to time to reflect changes to the site or our practices. Continued use of Sikh Jagat after changes are posted means you accept the revised policy." },
    { h: "Contact Us", p: "If you have questions about this Privacy Policy or how your information is handled, please reach out via the Contact page — we're happy to help." },
  ];
  return `
    <div class="page-wrap narrow">
      <div class="section-header">
        <div class="eyebrow">☬ Legal</div>
        <h2 class="section-title">Privacy Policy</h2>
        <p class="section-sub">Last updated: July 2026. This page explains how Sikh Jagat handles your information.</p>
      </div>
      <div class="card card-pad privacy-body">
        ${sections.map((s) => `<h3>${escapeHtml(s.h)}</h3><p>${escapeHtml(s.p)}</p>`).join("")}
      </div>
    </div>
  `;
}

function pageBookmarks() {
  if (state.bookmarks.length === 0) {
    return `<div class="page-wrap narrow"><div class="section-header"><div class="eyebrow">☬ Saved</div><h2 class="section-title">${t().bookmarks}</h2></div>
      <div class="empty-state"><span style="font-size:40px;">🔖</span><p>No bookmarks yet</p><p style="font-size:13px;">Tap the bookmark icon on any program, video, article or book to save it here.</p></div></div>`;
  }
  return `
    <div class="page-wrap narrow">
      <div class="section-header"><div class="eyebrow">☬ Saved</div><h2 class="section-title">${t().bookmarks}</h2></div>
      ${state.bookmarks.map((b) => `
        <div class="card" style="padding:14px;display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px;">
          <div style="display:flex;align-items:center;gap:12px;min-width:0;">
            <div class="icon-circle" style="margin-bottom:0;">🔖</div>
            <div style="min-width:0;"><p style="font-weight:600;font-size:14px;">${escapeHtml(b.title)}</p><span class="pill pill-navy">${b.type}</span></div>
          </div>
          <button data-action="bookmark" data-id="${b.id}" data-type="${b.type}" data-title="${escapeHtml(b.title)}" style="color:var(--color-text-soft);flex-shrink:0;">🗑</button>
        </div>
      `).join("")}
    </div>
  `;
}

function pageProfile() {
  if (!state.user) {
    return `<div class="page-wrap narrow" style="text-align:center;padding-top:100px;">
      <span style="font-size:40px;">👤</span>
      <p style="font-weight:700;margin-top:12px;">Sign in to manage your profile</p>
      <p style="font-size:13px;color:var(--color-text-muted);margin-top:4px;">Log in to edit your name, email, mobile number, or password.</p>
      <button class="btn btn-primary" id="open-auth-btn-2" style="margin-top:16px;">${t().login}</button>
    </div>`;
  }
  const record = state.user;
  return `
    <div class="page-wrap narrow">
      <div class="section-header"><div class="eyebrow">☬ Account</div><h2 class="section-title">My Profile</h2></div>

      <div class="card card-pad">
        <p style="font-weight:700;margin-bottom:14px;">Profile details</p>
        <div class="field"><label>Name</label><input id="profile-name" value="${escapeHtml(record.name || state.user.name)}" /></div>
        <div class="field"><label>Email</label><input id="profile-email" type="email" value="${escapeHtml(record.email || state.user.email)}" autocomplete="email" /></div>
        <div class="field"><label>Mobile number <span class="field-optional">(optional)</span></label><input id="profile-phone" type="tel" placeholder="+91 98765 43210" value="${escapeHtml(record.phone || "")}" autocomplete="tel" /></div>
        <button class="btn btn-primary" id="profile-save-details-btn">💾 Save changes</button>
      </div>

      <div class="card card-pad" style="margin-top:20px;">
        <p style="font-weight:700;margin-bottom:14px;">Change password</p>
        <div class="field">
          <label>Current password</label>
          <div class="input-with-action">
            <input id="profile-current-password" type="password" placeholder="••••••••" autocomplete="current-password" />
            <button type="button" class="input-action-btn" data-action="toggle-pw" data-target="profile-current-password" title="Show password">👁</button>
          </div>
        </div>
        <div class="field">
          <label>New password</label>
          <div class="input-with-action">
            <input id="profile-new-password" type="password" placeholder="••••••••" autocomplete="new-password" />
            <button type="button" class="input-action-btn" data-action="toggle-pw" data-target="profile-new-password" title="Show password">👁</button>
          </div>
        </div>
        <div class="field">
          <label>Confirm new password</label>
          <div class="input-with-action">
            <input id="profile-confirm-password" type="password" placeholder="••••••••" autocomplete="new-password" />
            <button type="button" class="input-action-btn" data-action="toggle-pw" data-target="profile-confirm-password" title="Show password">👁</button>
          </div>
        </div>
        <button class="btn btn-primary" id="profile-save-password-btn">🔒 Update password</button>
      </div>
    </div>
  `;
}

function pageQR() {
  const val = state._qrText || "https://sikhjagat.org";
  const url = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(val || " ")}`;
  return `
    <div class="page-wrap medium">
      <div class="section-header">
        <div class="eyebrow">☬ Share</div>
        <h2 class="section-title">QR Code Generator</h2>
        <p class="section-sub">Create a scannable QR code for any link, program flyer, or Gurdwara notice board.</p>
      </div>
      <div class="card card-pad grid grid-2" style="align-items:center;">
        <div>
          <div class="field"><label>Text or URL</label><textarea id="qr-input" rows="4">${escapeHtml(val)}</textarea></div>
          <button class="btn btn-primary btn-block" id="qr-download-btn">⬇ Download PNG</button>
        </div>
        <div class="qr-box"><div class="qr-frame"><img id="qr-img" src="${url}" width="200" height="200" alt="QR code" /></div></div>
      </div>
    </div>
  `;
}

function pageAdmin() {
  if (!state.user || state.user.role !== "admin") {
    return `<div class="page-wrap narrow" style="text-align:center;padding-top:100px;">
      <span style="font-size:40px;">🛡️</span>
      <p style="font-weight:700;margin-top:12px;">Admin access required</p>
      <p style="font-size:13px;color:var(--color-text-muted);margin-top:4px;">Log in with an admin account to view this dashboard.</p>
      <button class="btn btn-primary" id="open-auth-btn-2" style="margin-top:16px;">${t().login}</button>
    </div>`;
  }
  const tab = state._adminTab || "overview";
  const tabs = [
    ["overview","📊 Overview"], ["cms","✏️ Site Text"],
    ["live","📡 Live Classes"], ["videos","🎥 Videos"], ["photos","🖼️ Photos"], ["vlogs","🎬 Vlogs"],
    ["podcasts","🎙️ Podcasts"], ["articles","📰 Articles"], ["playlists","📺 YT Playlists"], ["library","📚 Library"],
    ["programs","🎓 Programs"], ["services","🛠️ Services"], ["resources","📄 Resources"],
    ["posts","📸 Community Posts"], ["seo","🔍 SEO"], ["notify","🔔 Push Notifications"],
    ["messages","💬 Messages"], ["users","👥 Users"],
  ];
  const avgRating = state.feedbackList.length ? (state.feedbackList.reduce((s,f) => s+f.rating,0) / state.feedbackList.length).toFixed(1) : "—";

  let body = "";
  if (CONTENT_TYPES[tab]) {
    body = renderContentManagerTab(tab);
  } else if (tab === "overview") {
    body = `
      <div class="grid grid-5">
        <div class="card card-pad stat-card">
          <div class="stat-icon" style="background:#dcfce7;color:#15803d;">🟢</div>
          <p class="stat-value" id="stat-active-now">${state.activeUsers}</p><p class="stat-label">Active right now</p>
        </div>
        ${[["👁","Total visitors",state.visitorCount.toLocaleString()],["👥","Registered members",state.users.length],
          ["⭐","Avg. feedback rating",avgRating],["💬","Contact messages",state.contactMessages.length]].map(([icon,label,val]) => `
          <div class="card card-pad stat-card">
            <div class="stat-icon" style="background:var(--color-primary-light);">${icon}</div>
            <p class="stat-value">${val}</p><p class="stat-label">${label}</p>
          </div>
        `).join("")}
      </div>
      <p style="font-size:11px;color:var(--color-text-soft);margin-top:10px;">
        "Active right now" counts open browser tabs on this device (a real multi-user count needs a backend — see note in README).
      </p>
      <div class="card card-pad" style="margin-top:20px;">
        <p style="font-weight:700;margin-bottom:14px;">📈 Visitor trend (simulated)</p>
        <div class="bar-chart">${[40,55,35,70,60,90,75,65,80,95,70,85].map((h) => `<div style="height:${h}%"></div>`).join("")}</div>
      </div>
      <div class="card card-pad" style="margin-top:20px;">
        <p style="font-weight:700;margin-bottom:14px;">🏆 Most viewed content</p>
        ${(() => {
          const top = ["video","photo","vlog","podcast","article","playlist"]
            .flatMap((mt) => state[MEDIA_STATE_KEYS[mt]].map((item) => ({ type: mt, item, eng: peekEng(mt, item.id) })))
            .filter((x) => x.eng.views > 0)
            .sort((a, b) => b.eng.views - a.eng.views)
            .slice(0, 6);
          if (top.length === 0) return `<div class="empty-state" style="padding:20px 0;"><p>No views tracked yet — they'll show up here as visitors open videos, photos, vlogs, podcasts and articles.</p></div>`;
          return top.map(({ type, item }) => `
            <div class="list-row">
              <div style="min-width:0;"><p style="font-size:13px;font-weight:600;">${escapeHtml(item.title)}</p><p style="font-size:11px;color:var(--color-text-soft);text-transform:capitalize;">${type}</p></div>
              <span style="font-size:12px;font-weight:600;color:var(--color-primary);flex-shrink:0;">${engMini(type, item.id)}</span>
            </div>`).join("");
        })()}
      </div>
      <div class="card card-pad" style="margin-top:20px;">
        <p style="font-weight:700;margin-bottom:14px;">🔔 Recent activity</p>
        ${state.adminAlerts.length === 0 ? `<div class="empty-state" style="padding:20px 0;"><p>Nothing yet — new messages, feedback and sign-ups will show up here.</p></div>` :
          state.adminAlerts.slice().reverse().slice(0, 20).map((a) => `
            <div class="list-row">
              <span style="font-size:18px;flex-shrink:0;">${a.icon}</span>
              <div style="flex:1;min-width:0;">
                <p style="font-weight:600;font-size:13px;">${escapeHtml(a.title)}</p>
                <p style="font-size:12px;color:var(--color-text-muted);">${escapeHtml(a.body)}</p>
              </div>
              <span style="font-size:10px;color:var(--color-text-soft);white-space:nowrap;">${escapeHtml(a.time)}</span>
            </div>`).join("")}
      </div>`;
  } else if (tab === "cms") {
    const fields = [["heroTitle","Home hero title"],["heroSub","Home hero subtitle"],["aboutText","About us — main paragraph"],
      ["missionText","Mission statement"],["contactAddress","Contact — address"],["contactPhone","Contact — phone"],["contactEmail","Contact — email"],
      ["whatsappNumber","WhatsApp number (with country code, e.g. +91 98140 00000)"]];
    body = `<div class="card card-pad">
      <p style="font-size:13px;color:var(--color-text-muted);margin-bottom:16px;">Edit the live content shown on Home and About. Changes apply immediately for all visitors.</p>
      ${fields.map(([key,label]) => `
        <div class="field"><label>${label}</label>
        ${key === "aboutText" || key === "heroSub" ? richTextField(`cms-${key}`, state.cms[key], label, key === "aboutText" ? 5 : 3) : `<input id="cms-${key}" value="${escapeHtml(state.cms[key])}" />`}
        ${key === "whatsappNumber" ? `<p style="font-size:11px;color:var(--color-text-soft);margin-top:4px;">The floating 💬 button opens a WhatsApp chat directly to this number.</p>` : ""}
        </div>`).join("")}
      <button class="btn btn-primary" id="cms-save-btn">💾 Save changes</button>
    </div>`;
  } else if (tab === "posts") {
    const previewSrc = state._postImageData || "";
    body = `
      <div class="grid grid-2">
        <div class="card card-pad">
          <p style="font-weight:700;margin-bottom:4px;">📸 Post an update</p>
          <p style="font-size:13px;color:var(--color-text-muted);margin-bottom:16px;">Just like posting to Instagram — pick a photo, write a caption, hit post. It appears instantly on the public "Posts" page.</p>

          <label class="upload-drop" for="post-image-input">
            ${previewSrc
              ? `<img src="${previewSrc}" class="upload-preview" alt="preview" />`
              : `<div style="font-size:30px;margin-bottom:8px;">📷</div>`}
            <p style="font-size:13px;font-weight:600;">${previewSrc ? "Change photo" : "Click to choose a photo"}</p>
            <p style="font-size:11px;color:var(--color-text-soft);margin-top:2px;">JPG or PNG, resized automatically</p>
            <input type="file" id="post-image-input" accept="image/*" />
          </label>

          <div class="field" style="margin-top:16px;">
            <label>Caption</label>
            ${richTextField("post-caption", state._postCaptionDraft, "What's happening at Sikh Jagat today?", 3)}
          </div>
          <button class="btn btn-primary btn-block" id="post-submit-btn">📤 Post to Sikh Jagat</button>
        </div>

        <div class="card card-pad" style="max-height:440px;overflow-y:auto;">
          <p style="font-weight:700;margin-bottom:10px;">Published posts (${state.posts.length})</p>
          ${state.posts.length === 0 ? `<div class="empty-state"><p>No posts yet</p></div>` :
            state.posts.slice().reverse().map((p) => `
              <div class="list-row" style="align-items:flex-start;">
                <div style="display:flex;gap:10px;min-width:0;">
                  ${p.image ? `<img src="${p.image}" style="width:44px;height:44px;border-radius:8px;object-fit:cover;flex-shrink:0;" />` : `<div class="icon-circle" style="margin-bottom:0;flex-shrink:0;">☬</div>`}
                  <div style="min-width:0;"><div class="rich-text" style="font-size:13px;">${p.caption}</div><p style="font-size:11px;color:var(--color-text-soft);margin-top:2px;">${escapeHtml(p.author)} · ${escapeHtml(p.time)}</p></div>
                </div>
                <button data-action="delete-post" data-id="${p.id}" style="color:var(--color-error);flex-shrink:0;">🗑</button>
              </div>
            `).join("")}
        </div>
      </div>`;
  } else if (tab === "seo") {
    body = `<div class="card card-pad">
      <p style="font-size:13px;color:var(--color-text-muted);margin-bottom:16px;">Meta tags control how Sikh Jagat appears in search results and social shares.</p>
      <div class="field"><label>Meta title</label><input id="cms-seoTitle" value="${escapeHtml(state.cms.seoTitle)}" /></div>
      <div class="field"><label>Meta description</label><textarea id="cms-seoDesc" rows="3">${escapeHtml(state.cms.seoDesc)}</textarea></div>
      <div class="field"><label>Keywords (comma separated)</label><input id="cms-seoKeywords" value="${escapeHtml(state.cms.seoKeywords)}" /></div>
      <button class="btn btn-primary" id="cms-save-btn">💾 Save SEO settings</button>
      <div style="border:1px solid var(--color-border);border-radius:12px;padding:16px;margin-top:16px;background:var(--color-bg-soft);">
        <p style="font-size:10px;color:var(--color-text-soft);margin-bottom:4px;">Google preview</p>
        <p style="color:#1a73e8;font-size:17px;">${escapeHtml(state.cms.seoTitle)}</p>
        <p style="color:#188038;font-size:12px;">sikhjagat.org</p>
        <p style="font-size:13px;color:var(--color-text-muted);margin-top:4px;">${escapeHtml(state.cms.seoDesc)}</p>
      </div>
    </div>`;
  } else if (tab === "notify") {
    body = `<div class="grid grid-2">
      <div class="card card-pad">
        <p style="font-weight:700;margin-bottom:4px;">Send a push notification</p>
        <p style="font-size:13px;color:var(--color-text-muted);margin-bottom:14px;">Appears instantly in every visitor's notification bell.</p>
        <div class="field"><label>Title</label><input id="notif-title" placeholder="Live Kirtan starting now" /></div>
        <div class="field"><label>Body</label><textarea id="notif-body" rows="3" placeholder="Join Bhai Manpreet Singh for..."></textarea></div>
        <button class="btn btn-primary btn-block" id="notif-send-btn">🔔 Send to all visitors</button>
      </div>
      <div class="card card-pad" style="max-height:360px;overflow-y:auto;">
        <p style="font-weight:700;margin-bottom:10px;">Notification history</p>
        ${state.notifications.length === 0 ? `<div class="empty-state"><p>No notifications sent yet</p></div>` :
          state.notifications.slice().reverse().map((n) => `
            <div class="list-row" style="display:block;"><p style="font-weight:600;font-size:13px;">${escapeHtml(n.title)}</p><p style="font-size:12px;color:var(--color-text-muted);">${escapeHtml(n.body)}</p><p style="font-size:10px;color:var(--color-text-soft);margin-top:2px;">${escapeHtml(n.time)}</p></div>
          `).join("")}
      </div>
    </div>`;
  } else if (tab === "messages") {
    body = `<div class="grid grid-2">
      <div class="card card-pad" style="max-height:420px;overflow-y:auto;">
        <p style="font-weight:700;margin-bottom:10px;">✉️ Contact messages (${state.contactMessages.length})</p>
        ${state.contactMessages.length === 0 ? `<div class="empty-state"><p>No messages yet</p></div>` :
          state.contactMessages.slice().reverse().map((m) => `
            <div class="list-row" style="display:block;">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
                <div><p style="font-weight:600;font-size:13px;">${escapeHtml(m.name)}</p><p style="font-size:12px;color:var(--color-text-muted);">${escapeHtml(m.email)}</p></div>
                <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
                  <p style="font-size:10px;color:var(--color-text-soft);white-space:nowrap;">${escapeHtml(m.time)}</p>
                  <button data-action="delete-message" data-id="${m.id}" title="Delete message" style="background:none;border:none;cursor:pointer;color:var(--color-error);font-size:14px;padding:0;">🗑</button>
                </div>
              </div>
              <p style="font-size:13px;margin-top:4px;">${escapeHtml(m.message)}</p>
              ${m.reply ? `
                <div style="margin-top:8px;padding:8px 10px;border-radius:8px;background:var(--color-bg-soft);border-left:3px solid var(--color-primary);">
                  <p style="font-size:11px;font-weight:700;color:var(--color-primary);">↩ Your reply <span style="font-weight:400;color:var(--color-text-soft);">· ${escapeHtml(m.reply_time)}</span></p>
                  <p class="rich-text" style="font-size:13px;margin-top:2px;">${m.reply}</p>
                </div>` : `
                <div class="field" style="margin-top:8px;margin-bottom:0;">
                  ${richTextField(`msg-reply-${m.id}`, "", "Write a reply…", 2)}
                  <button class="btn btn-primary" data-action="reply-message" data-id="${m.id}" style="margin-top:6px;padding:6px 14px;font-size:12px;">↩ Send reply</button>
                </div>`}
            </div>`).join("")}
      </div>
      <div class="card card-pad" style="max-height:420px;overflow-y:auto;">
        <p style="font-weight:700;margin-bottom:10px;">⭐ Feedback (${state.feedbackList.length})</p>
        ${state.feedbackList.length === 0 ? `<div class="empty-state"><p>No feedback yet</p></div>` :
          state.feedbackList.slice().reverse().map((f) => `
            <div class="list-row" style="display:block;">
              <div>${"★".repeat(f.rating)}${"☆".repeat(5 - f.rating)} <span class="pill pill-navy">${f.category}</span></div>
              ${f.message ? `<p style="font-size:13px;margin-top:4px;">${escapeHtml(f.message)}</p>` : ""}
            </div>`).join("")}
      </div>
    </div>`;
  } else if (tab === "users") {
    body = `<div class="card card-pad">
      <p style="font-weight:700;margin-bottom:14px;">Registered users (${state.users.length})</p>
      ${state.users.length === 0 ? `<div class="empty-state"><p>No registered users yet</p></div>` :
        state.users.map((u) => `
          <div class="list-row">
            <div style="display:flex;align-items:center;gap:10px;"><span class="user-avatar">${u.name.slice(0,1).toUpperCase()}</span>
              <div><p style="font-weight:600;font-size:13px;">${escapeHtml(u.name)}</p><p style="font-size:12px;color:var(--color-text-muted);">${escapeHtml(u.email)}</p></div>
            </div>
            <span class="pill ${u.role === "admin" ? "pill-maroon" : "pill-navy"}">${u.role}</span>
          </div>`).join("")}
    </div>`;
  }

  return `
    <div class="page-wrap">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:30px;">
        <div class="icon-circle" style="margin-bottom:0;background:var(--color-navy);color:#fef3c7;">📊</div>
        <div><h2 class="section-title" style="font-size:24px;margin-bottom:2px;">Admin Dashboard</h2><p style="font-size:13px;color:var(--color-text-muted);">Manage content, messages and notifications</p></div>
      </div>
      <div class="admin-tabs">${tabs.map(([key,label]) => `<button data-action="admin-tab" data-tab="${key}" class="${tab === key ? "active" : ""}">${label}</button>`).join("")}</div>
      ${body}
    </div>
  `;
}

/* Generic admin tab: an "add new item" form built from CONTENT_TYPES[typeKey].fields,
   plus a list of existing items with delete (and live-toggle, where relevant) buttons.
   Powers every content type an admin can upload — Live Classes, Videos, Photos, Vlogs,
   Podcasts, Articles, Library, Programs, Services, Resources — from one shared pattern. */
function renderContentManagerTab(typeKey) {
  const cfg = CONTENT_TYPES[typeKey];
  const items = state[cfg.stateKey];
  const draftImg = (cfg.hasImage && state._contentImageDraftType === typeKey) ? state._contentImageDraft : "";
  const draftFileName = (cfg.hasFile && state._contentFileDraftType === typeKey) ? state._contentFileDraftName : "";
  const draftFileSize = (cfg.hasFile && state._contentFileDraftType === typeKey) ? state._contentFileDraftSize : 0;

  return `
    <div class="grid grid-2">
      <div class="card card-pad">
        <p style="font-weight:700;margin-bottom:4px;">${cfg.icon} Add to ${cfg.label}</p>
        <p style="font-size:13px;color:var(--color-text-muted);margin-bottom:16px;">Appears instantly on the public ${cfg.label} page for every visitor.</p>
        ${cfg.hasImage ? `
          <label class="upload-drop" for="content-image-input">
            ${draftImg ? `<img src="${draftImg}" class="upload-preview" alt="preview" />` : `<div style="font-size:30px;margin-bottom:8px;">📷</div>`}
            <p style="font-size:13px;font-weight:600;">${draftImg ? "Change photo" : "Click to choose a photo"}</p>
            <p style="font-size:11px;color:var(--color-text-soft);margin-top:2px;">JPG or PNG, resized automatically</p>
            <input type="file" id="content-image-input" data-content-type="${typeKey}" accept="image/*" />
          </label>
        ` : ""}
        ${cfg.hasFile ? `
          <label class="upload-drop" for="content-file-input">
            <div style="font-size:30px;margin-bottom:8px;">${draftFileName ? "📄" : "📥"}</div>
            <p style="font-size:13px;font-weight:600;">${draftFileName ? `Selected: ${escapeHtml(draftFileName)}` : "Click or drop a PDF here"}</p>
            <p style="font-size:11px;color:var(--color-text-soft);margin-top:2px;">${draftFileName ? formatFileSize(draftFileSize) : "PDF files only, up to 8 MB"}</p>
            <input type="file" id="content-file-input" data-content-type="${typeKey}" accept="application/pdf,.pdf" />
          </label>
        ` : ""}
        ${cfg.fields.map(([key, label]) => `
          <div class="field"><label>${label}</label>
          ${key === "desc" ? richTextField(`content-field-${key}`, "", label, 3) : ""}
          ${key === "linkType" ? `
            <select id="content-field-${key}">
              <option value="youtube">📺 YouTube Live — public, plays right on the site</option>
              <option value="external">🔒 Google Meet / Zoom — private, opens in a new tab</option>
            </select>` : ""}
          ${key !== "desc" && key !== "linkType" ? `<input id="content-field-${key}" placeholder="${label}" />` : ""}
          ${key === "link" && cfg.hasLiveToggle ? `<p style="font-size:11px;color:var(--color-text-soft);margin-top:4px;">Paste the YouTube video/live URL, or the Google Meet / Zoom link. Meet &amp; Zoom links open in a new tab since they can't be embedded and usually need sign-in; a YouTube link plays inline for every visitor.</p>` : ""}
          ${key === "link" && !cfg.hasLiveToggle && cfg.linkHint ? `<p style="font-size:11px;color:var(--color-text-soft);margin-top:4px;">${escapeHtml(cfg.linkHint)}</p>` : ""}
          </div>`).join("")}
        ${cfg.hasLiveToggle ? `
          <label style="display:flex;align-items:center;gap:8px;font-size:13px;margin-bottom:16px;">
            <input type="checkbox" id="content-field-live" /> Mark as currently live
          </label>` : ""}
        <button class="btn btn-primary btn-block" data-action="content-add" data-type="${typeKey}">➕ Add to ${cfg.label}</button>
      </div>

      <div class="card card-pad" style="max-height:440px;overflow-y:auto;">
        <p style="font-weight:700;margin-bottom:10px;">${cfg.label} (${items.length})</p>
        ${items.length === 0 ? `<div class="empty-state"><p>Nothing here yet</p></div>` :
          items.slice().reverse().map((item) => `
            <div class="list-row" style="align-items:flex-start;">
              <div style="display:flex;gap:10px;min-width:0;">
                ${cfg.hasImage && item.image ? `<img src="${item.image}" style="width:44px;height:44px;border-radius:8px;object-fit:cover;flex-shrink:0;" />` : `<div class="icon-circle" style="margin-bottom:0;flex-shrink:0;">${cfg.icon}</div>`}
                <div style="min-width:0;">
                  <p style="font-size:13px;">${escapeHtml(cfg.summary(item))}</p>
                  ${cfg.hasLiveToggle ? `<span class="pill ${item.live ? "pill-live" : "pill-navy"}" style="margin-top:4px;display:inline-block;">${item.live ? "● LIVE" : "Upcoming"}</span>` : ""}
                  ${cfg.hasLiveToggle ? `<span style="font-size:11px;color:var(--color-text-soft);margin-left:6px;">${item.link ? (item.linkType === "external" ? "🔒 Meet/Zoom link set" : "📺 YouTube link set") : "⚠️ No stream link yet"}</span>` : ""}
                  ${cfg.mediaType ? `<p style="font-size:11px;color:var(--color-text-soft);margin-top:4px;">${engMini(cfg.mediaType, item.id)}</p>` : ""}
                </div>
              </div>
              <div style="display:flex;gap:10px;flex-shrink:0;">
                ${cfg.hasLiveToggle ? `<button data-action="content-toggle-live" data-type="${typeKey}" data-id="${item.id}" title="Toggle live status">📡</button>` : ""}
                <button data-action="content-delete" data-type="${typeKey}" data-id="${item.id}" style="color:var(--color-error);" title="Delete">🗑</button>
              </div>
            </div>
          `).join("")}
      </div>
    </div>
  `;
}

function pagePosts() {
  const posts = state.posts.slice().reverse();
  return `
    <div class="page-wrap">
      <div class="section-header">
        <div class="eyebrow">☬ Community</div>
        <h2 class="section-title">${t().posts}</h2>
        <p class="section-sub">Quick updates and moments shared directly by the Sikh Jagat team.</p>
      </div>
      ${posts.length === 0 ? `
        <div class="empty-state"><span style="font-size:40px;">📸</span><p>No posts yet</p><p style="font-size:13px;">Check back soon — the team posts updates here directly, just like a social feed.</p></div>
      ` : `
        <div class="posts-grid">
          ${posts.map((p) => `
            <div class="card post-card">
              ${p.image ? `<img class="post-image" src="${p.image}" alt="" />` : `<div class="post-image-placeholder">☬</div>`}
              <div class="post-body">
                <div class="post-caption rich-text">${p.caption}</div>
                <div class="post-meta"><span>${escapeHtml(p.author)}</span><span>${escapeHtml(p.time)}</span></div>
              </div>
            </div>
          `).join("")}
        </div>
      `}
    </div>
  `;
}

/* --------------------------- 6. MASTER RENDER --------------------------- */
const PAGE_RENDERERS = {
  home: pageHome, about: pageAbout, programs: pagePrograms, services: pageServices,
  resources: pageResources, library: pageLibrary, live: pageLive, videos: pageVideos,
  photos: pagePhotos, vlogs: pageVlogs, podcasts: pagePodcasts, articles: pageArticles,
  contact: pageContact, feedback: pageFeedback, bookmarks: pageBookmarks, qr: pageQR, admin: pageAdmin, posts: pagePosts,
  faq: pageFAQ, privacy: pagePrivacy, profile: pageProfile,
};

function render() {
  renderHeader();
  renderFooter();
  const fn = PAGE_RENDERERS[state.page] || pageHome;
  document.getElementById("app").innerHTML = fn();
  applyLangNotice();
  document.title = state.cms.seoTitle;
}

function navigate(page) {
  state.page = page;
  if (page === "admin") markAdminAlertsRead();
  window.scrollTo({ top: 0, behavior: "smooth" });
  closeAllMenus();
  render();
}

function closeAllMenus() {
  document.querySelectorAll(".dropdown-menu").forEach((m) => m.classList.add("hidden"));
  document.getElementById("mobile-nav").classList.add("hidden");
}

/* Jumps to the exact item a search result points to: switches to its page,
   scrolls straight to its card (skipping the usual scroll-to-top), and
   flashes a glowing highlight ring around it so it's obvious which item
   matched. For media types (photo/video/vlog/podcast/article) it also
   opens the detail modal for that exact item once the highlight lands. */
function goToSearchResult(page, id, mediaType) {
  state.page = page;
  if (page === "library") state.libraryFilter = "All";
  if (page === "videos") state.videoView = "all";
  state._searchTarget = mediaType ? { id, mediaType } : null;
  closeAllMenus();
  render();

  flashSearchHighlight(id, mediaType, mediaType);
}

/* Flashes the glowing ring around the card matching `id` (see .search-highlight
   / .search-highlight-photo in style.css) so it's obvious which item a search
   result landed on. For grid items like Photos, where a thumbnail is easy to
   lose among a dozen similar-looking ones, `highlightType === "photo"` adds
   an extra "🔍 Found it" ribbon (.search-highlight-photo) so it stands out
   even more. If `openModalType` is set, the detail modal for that item opens
   shortly after — with enough delay for the highlight to register on screen
   *before* the modal covers it, instead of the modal appearing almost instantly. */
function flashSearchHighlight(id, highlightType, openModalType) {
  requestAnimationFrame(() => {
    const target = document.querySelector(`#app [data-search-id="${id}"]`);
    const highlightClass = highlightType === "photo" ? "search-highlight-photo" : "search-highlight";
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      target.classList.add(highlightClass);
      setTimeout(() => target.classList.remove(highlightClass), 2600);
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    if (openModalType) {
      setTimeout(() => openMediaModal(openModalType, id), target ? 1100 : 50);
    }
  });
}

/* --------------------------- 7. EVENT HANDLING --------------------------- */
// One delegated listener handles clicks anywhere in the app — this avoids
// having to re-attach listeners every time render() rebuilds the HTML.
document.addEventListener("click", (e) => {
  const pageBtn = e.target.closest("[data-page]");
  const actionBtn = e.target.closest("[data-action]");
  const langBtn = e.target.closest("[data-lang]");

  // close dropdowns when clicking outside them
  if (!e.target.closest(".dropdown")) closeAllMenus();

  // Note: search-result buttons intentionally carry BOTH data-page (so we know
  // which page to switch to) and data-action="search-goto" (so we can also
  // scroll/highlight/open the exact item). They must be excluded here so they
  // fall through to the data-action handling below instead of just doing a
  // plain top-of-page navigate() and stopping short of the real jump.
  if (pageBtn && !(actionBtn && actionBtn.dataset.action === "search-goto")) { navigate(pageBtn.dataset.page); return; }

  if (langBtn) { state.lang = langBtn.dataset.lang; storageSet("language", state.lang); closeAllMenus(); render(); return; }

  if (e.target.id === "lang-btn") { toggleMenu("lang-menu"); return; }
  if (e.target.closest("#dark-toggle-btn")) { toggleDark(); return; }
  if (e.target.closest("#notif-btn")) { toggleMenu("notif-menu"); if (state.user && state.user.role === "admin") markAdminAlertsRead(); markNotificationsRead(); return; }
  if (e.target.closest("#search-btn")) {
    const wasHidden = document.getElementById("search-menu").classList.contains("hidden");
    toggleMenu("search-menu");
    if (wasHidden) setTimeout(() => document.getElementById("search-input")?.focus(), 0);
    return;
  }

  if (e.target.closest("#profile-btn")) { toggleMenu("profile-menu"); return; }
  if (e.target.closest("#media-dropdown-btn")) { toggleMenu("media-dropdown-menu"); return; }
  if (e.target.closest("#mobile-menu-btn")) { document.getElementById("mobile-nav").classList.toggle("hidden"); return; }
  if (e.target.closest("#logout-btn")) { logout(); return; }
  if (e.target.closest("#open-auth-btn") || e.target.closest("#open-auth-btn-2")) { openAuthModal("login"); return; }
  if (e.target.closest("#auth-modal-close")) { closeAuthModal(); return; }
  if (e.target.closest("#media-modal-close") || e.target.id === "media-modal-backdrop") { closeMediaModal(); return; }
  if (e.target.closest("#media-modal-prev")) { navigateMediaModal(-1); return; }
  if (e.target.closest("#media-modal-next")) { navigateMediaModal(1); return; }
  if (e.target.closest("#media-modal-fullscreen")) { toggleMediaModalFullscreen(); return; }

  if (actionBtn) {
    const a = actionBtn.dataset;
    if (a.action === "bookmark") { toggleBookmark(a.id, a.type, a.title); return; }
    if (a.action === "lib-filter") { state.libraryFilter = a.cat; render(); return; }
    if (a.action === "video-view") { state.videoView = a.view; render(); return; }
    if (a.action === "admin-tab") { state._adminTab = a.tab; render(); return; }
    if (a.action === "play") { toast(`Playing: ${a.title}`, "success"); return; }
    if (a.action === "open-media") { openMediaModal(a.type, a.id); return; }
    if (a.action === "toggle-like") { toggleLike(a.type, a.id); return; }
    if (a.action === "share-item") { shareItem(a.type, a.id); return; }
    if (a.action === "add-comment") { addComment(a.type, a.id); return; }
    if (a.action === "delete-comment") { deleteComment(a.type, a.id, a.commentId); return; }
    if (a.action === "download-resource") { downloadResource(a.id, a.title); return; }
    if (a.action === "open-link") { if (a.link) window.open(a.link, "_blank", "noopener,noreferrer"); return; }
    if (a.action === "request-service") { openServiceRequestModal(a.id, a.title); return; }
    if (a.action === "watch-live") { openLiveClass(a.id); return; }
    if (a.action === "notify-me") { toast("You'll be notified when this starts", "success"); return; }
    if (a.action === "cms-save") { saveCmsFromForm(); return; }
    if (a.action === "notif-send") { sendAdminNotification(); return; }
    if (a.action === "delete-post") { deletePost(a.id); return; }
    if (a.action === "rte-bold") { execRichCommand("bold", a.target); return; }
    if (a.action === "rte-italic") { execRichCommand("italic", a.target); return; }
    if (a.action === "rte-underline") { execRichCommand("underline", a.target); return; }
    if (a.action === "content-add") { addContentItem(a.type); return; }
    if (a.action === "content-delete") { deleteContentItem(a.type, a.id); return; }
    if (a.action === "content-toggle-live") { toggleContentLive(a.type, a.id); return; }
    if (a.action === "reply-message") { replyToMessage(a.id); return; }
    if (a.action === "delete-message") { deleteMessage(a.id); return; }
    if (a.action === "notif-toggle-enabled") { toggleNotificationsEnabled(); return; }
    if (a.action === "toggle-pw") { togglePasswordVisibility(a.target); return; }
    if (a.action === "open-forgot") { openForgotPassword(); return; }
    if (a.action === "back-to-login") { openAuthModal("login"); return; }
    if (a.action === "resend-otp") { sendResetOtp(); return; }
    if (a.action === "search-goto") {
      const { page, id, mediaType } = a;
      state.search = "";
      goToSearchResult(page, id, mediaType || null);
      return;
    }
  }

  if (e.target.id === "post-submit-btn") { submitPost(); return; }

  if (e.target.id === "cms-save-btn") { saveCmsFromForm(); return; }
  if (e.target.id === "profile-save-details-btn") { saveProfileDetails(); return; }
  if (e.target.id === "profile-save-password-btn") { saveProfilePassword(); return; }
  if (e.target.id === "notif-send-btn") { sendAdminNotification(); return; }
  if (e.target.id === "qr-download-btn") { downloadQr(); return; }

  if (e.target.closest("#feedback-stars button")) {
    state._rating = Number(e.target.closest("button").dataset.star);
    document.querySelectorAll("#feedback-stars button").forEach((b, i) => b.classList.toggle("filled", i < state._rating));
    return;
  }
  if (e.target.id === "feedback-submit-btn") { submitFeedback(); return; }
});

function toggleMenu(id) {
  const el = document.getElementById(id);
  const wasHidden = el.classList.contains("hidden");
  closeAllMenus();
  if (wasHidden) el.classList.remove("hidden");
}

function toggleDark() {
  state.dark = !state.dark;
  document.documentElement.setAttribute("data-theme", state.dark ? "dark" : "light");
  storageSet("dark-mode", state.dark);
  render();
}

function markNotificationsRead() {
  state.readNotifIds = state.notifications.map((n) => n.id);
  storageSet("read-notifs", state.readNotifIds);
  render();
}

function toggleNotificationsEnabled() {
  state.notificationsEnabled = !state.notificationsEnabled;
  storageSet("notifications-enabled", state.notificationsEnabled);
  toast(state.notificationsEnabled ? "Notifications turned on" : "Notifications turned off", "info");
  render();
}

/* Adds a notification that shows up for every visitor (badge + dropdown) the
   moment the admin uploads something new — used by every content type. */
function pushAutoNotification(title, body) {
  const entry = { id: Math.random().toString(36).slice(2), title, body, time: new Date().toLocaleString() };
  state.notifications.push(entry);
  storageSet("notifications", state.notifications);
  if (state.notificationsEnabled && typeof Notification !== "undefined" && Notification.permission === "granted") {
    try { new Notification(title, { body }); } catch (e) {}
  }
}

/* Internal "something happened" feed for admins only — new contact messages,
   feedback and sign-ups all land here so admin never has to go hunting
   through every tab to see what's new. Shown as a badge + list in the
   Admin Dashboard's Overview tab (unlike pushAutoNotification, this never
   shows up in a regular visitor's bell menu). */
function pushAdminAlert(icon, title, body) {
  const entry = { id: Math.random().toString(36).slice(2), icon, title, body, time: new Date().toLocaleString() };
  state.adminAlerts.push(entry);
  storageSet("admin-alerts", state.adminAlerts);
}

function markAdminAlertsRead() {
  state.readAdminAlertIds = state.adminAlerts.map((a) => a.id);
  storageSet("read-admin-alerts", state.readAdminAlertIds);
}

// live-update the QR image / textarea and contact/feedback forms as the
// user types, using plain "input" events (delegated the same way as clicks)
document.addEventListener("keydown", (e) => {
  if (document.getElementById("media-modal-backdrop").classList.contains("hidden")) return;
  if (e.key === "ArrowRight") navigateMediaModal(1);
  else if (e.key === "ArrowLeft") navigateMediaModal(-1);
  else if (e.key === "Escape") closeMediaModal();
});

document.addEventListener("input", (e) => {
  if (e.target.id === "search-input") {
    state.search = e.target.value;
    renderSearchMenu();
    return;
  }
  if (e.target.id === "qr-input") {
    const url = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(e.target.value || " ")}`;
    document.getElementById("qr-img").src = url;
    state._qrText = e.target.value;
  }
  if (e.target.id === "post-caption") { state._postCaptionDraft = e.target.innerHTML; }
  if (e.target.classList && e.target.classList.contains("rte-color-input")) {
    const targetId = e.target.dataset.target;
    restoreRichSelection(targetId);
    document.execCommand("foreColor", false, e.target.value);
    syncPostCaptionDraft();
  }
});

document.addEventListener("change", (e) => {
  if (e.target.classList && e.target.classList.contains("rte-font-select") && e.target.value) {
    const targetId = e.target.dataset.target;
    restoreRichSelection(targetId);
    document.execCommand("fontName", false, e.target.value);
    syncPostCaptionDraft();
  }
  if (e.target.classList && e.target.classList.contains("rte-size-select") && e.target.value) {
    const targetId = e.target.dataset.target;
    restoreRichSelection(targetId);
    applyRichFontSize(e.target.value, targetId);
    syncPostCaptionDraft();
  }
});

// Track the last text selection made inside each rich-text editor, since
// clicking a <select> or <input type="color"> in its toolbar steals focus
// (and with it, the browser's selection) away from the contenteditable box.
// Keyed by editor id so several rich-text fields can sit on screen at once
// (e.g. the CMS tab has two) without clobbering each other's selection.
const savedRichSelections = {};
document.addEventListener("selectionchange", () => {
  const editor = document.activeElement;
  if (!editor || !editor.classList || !editor.classList.contains("rte-editable")) return;
  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0) savedRichSelections[editor.id] = sel.getRangeAt(0).cloneRange();
});

function restoreRichSelection(targetId) {
  const editor = document.getElementById(targetId);
  if (!editor) return;
  editor.focus();
  const range = savedRichSelections[targetId];
  if (range) {
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }
}

function execRichCommand(command, targetId) {
  const editor = document.getElementById(targetId);
  if (!editor) return;
  editor.focus();
  document.execCommand(command);
  syncPostCaptionDraft();
}

// document.execCommand("fontSize") only accepts legacy sizes 1-7 and produces
// deprecated <font size="7"> tags — apply size 7 as a sentinel, then swap
// each resulting <font> tag for a <span style="font-size:Npx"> instead.
function applyRichFontSize(px, targetId) {
  document.execCommand("fontSize", false, "7");
  const editor = document.getElementById(targetId);
  if (!editor) return;
  editor.querySelectorAll('font[size="7"]').forEach((f) => {
    const span = document.createElement("span");
    span.style.fontSize = px + "px";
    while (f.firstChild) span.appendChild(f.firstChild);
    f.replaceWith(span);
  });
}

// Only the Community Posts caption keeps a live draft in `state` (so it
// survives switching admin tabs and back) — every other rich-text field
// reads straight from the DOM at save time instead, same as the plain
// inputs/textareas around it always have.
function syncPostCaptionDraft() {
  const editor = document.getElementById("post-caption");
  if (editor) state._postCaptionDraft = editor.innerHTML;
}

// Resize an uploaded image client-side (max 800px wide) before turning it into
// a data URL — keeps localStorage usage sane, since raw phone photos can be
// several MB each and localStorage typically caps out around 5-10MB total.
function resizeImageFile(file, maxWidth = 800) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function formatFileSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

/* Shared handler for every file input / drop zone in the app — routes to the
   right behavior based on which input received the file, whether it came
   from a click-to-browse (change event) or an actual drag-and-drop. */
async function handleUploadedFile(inputEl, file) {
  if (!file) return;
  if (inputEl.id === "post-image-input") {
    try { state._postImageData = await resizeImageFile(file); render(); }
    catch (err) { toast("Couldn't read that image — try a different file", "error"); }
    return;
  }
  if (inputEl.id === "content-image-input") {
    try {
      state._contentImageDraft = await resizeImageFile(file);
      state._contentImageDraftType = inputEl.dataset.contentType;
      render();
    } catch (err) { toast("Couldn't read that image — try a different file", "error"); }
    return;
  }
  if (inputEl.id === "content-file-input") {
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) { toast("Please choose a PDF file", "error"); return; }
    if (file.size > 8 * 1024 * 1024) { toast("That PDF is too large for this demo (over 8 MB) — try a smaller file or paste a link instead", "error"); return; }
    try {
      state._contentFileDraft = await readFileAsDataUrl(file);
      state._contentFileDraftName = file.name;
      state._contentFileDraftSize = file.size;
      state._contentFileDraftType = inputEl.dataset.contentType;
      render();
    } catch (err) { toast("Couldn't read that file — try again", "error"); }
    return;
  }
}

document.addEventListener("change", async (e) => {
  if (e.target.matches('input[type="file"]')) await handleUploadedFile(e.target, e.target.files[0]);
});

// Real drag-and-drop support for every ".upload-drop" zone (photo and PDF
// uploaders alike) — not just click-to-browse.
document.addEventListener("dragover", (e) => {
  const zone = e.target.closest(".upload-drop");
  if (zone) { e.preventDefault(); zone.classList.add("drag-over"); }
});
document.addEventListener("dragleave", (e) => {
  const zone = e.target.closest(".upload-drop");
  if (zone) zone.classList.remove("drag-over");
});
document.addEventListener("drop", async (e) => {
  const zone = e.target.closest(".upload-drop");
  if (!zone) return;
  e.preventDefault();
  zone.classList.remove("drag-over");
  const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
  const input = zone.querySelector('input[type="file"]');
  if (file && input) await handleUploadedFile(input, file);
});

document.addEventListener("submit", (e) => {
  if (e.target.id === "contact-form") { e.preventDefault(); submitContactForm(); }
  if (e.target.id === "auth-form") { e.preventDefault(); submitAuthForm(); }
  if (e.target.id === "forgot-form") { e.preventDefault(); handleForgotSubmit(); }
  if (e.target.id === "otp-form") { e.preventDefault(); handleOtpSubmit(); }
  if (e.target.id === "reset-form") { e.preventDefault(); handleResetSubmit(); }
  if (e.target.id === "service-request-form") { e.preventDefault(); submitServiceRequest(); }
});

/* --------------------------- 8. FEATURE LOGIC --------------------------- */

/* ---- Contact form ---- */
async function submitContactForm() {
  const name = document.getElementById("contact-name").value.trim();
  const email = document.getElementById("contact-email").value.trim();
  const message = document.getElementById("contact-message").value.trim();
  if (!name || !email || !message) { toast("Please fill in every field", "error"); return; }
  try {
    await api.sendMessage({ name, email, message });
    state.contactMessages = await api.getMessages().catch(() => state.contactMessages);
    pushAdminAlert("📬", "New contact message", `${name}: “${message.slice(0, 80)}${message.length > 80 ? "…" : ""}”`);
    toast("Message sent — we'll reply within 2 days", "success");
    render();
  } catch (e) {
    toast(e.message || "Couldn't send your message", "error");
  }
}

/* ---- Admin replying to a contact message ---- */
async function replyToMessage(id) {
  const input = document.getElementById(`msg-reply-${id}`);
  const plainText = input ? input.textContent.trim() : "";
  const html = input ? sanitizeRichHtml(input.innerHTML) : "";
  if (!plainText) { toast("Write a reply before sending", "error"); return; }
  try {
    const updated = await api.replyToMessage(id, html);
    state.contactMessages = state.contactMessages.map((m) => (m.id === id ? updated : m));
    // Let the sender know — a site-wide notification bell stands in for a
    // real per-account email/push notification in this build.
    pushAutoNotification(`💬 Reply from Sikh Jagat`, `Hi ${updated.name}, we replied to your message: “${plainText.slice(0, 100)}${plainText.length > 100 ? "…" : ""}”`);
    toast(`Reply sent to ${updated.name}`, "success");
    render();
  } catch (e) {
    toast(e.message || "Couldn't send reply", "error");
  }
}

/* ---- Deleting a contact message — admin can delete any message, a
   signed-in user can delete only their own (enforced server-side). ---- */
async function deleteMessage(id) {
  try {
    await api.deleteMessage(id);
    state.contactMessages = state.contactMessages.filter((m) => m.id !== id);
    toast("Message deleted", "success");
    render();
  } catch (e) {
    toast(e.message || "You can't delete this message", "error");
  }
}

/* ---- Feedback form ---- */
async function submitFeedback() {
  const rating = state._rating || 0;
  if (!rating) { toast("Please choose a star rating", "error"); return; }
  const category = document.getElementById("feedback-category").value;
  const text = document.getElementById("feedback-text").value.trim();
  try {
    await api.sendFeedback({ rating, category, message: text });
    if (state.user && state.user.role === "admin") state.feedbackList = await api.getFeedback().catch(() => state.feedbackList);
    pushAdminAlert("⭐", "New feedback received", `${"★".repeat(rating)}${"☆".repeat(5 - rating)} · ${category}${text ? ` — “${text.slice(0, 80)}${text.length > 80 ? "…" : ""}”` : ""}`);
    state._rating = 0;
    toast("Thank you for your feedback! 🙏", "success");
    render();
  } catch (e) {
    toast(e.message || "Couldn't send feedback", "error");
  }
}

/* ---- Admin: Community Posts (Instagram-style uploader) ---- */
async function submitPost() {
  const captionEl = document.getElementById("post-caption");
  const plainText = captionEl ? captionEl.textContent.trim() : "";
  const captionHtml = captionEl ? sanitizeRichHtml(captionEl.innerHTML) : "";
  if (!plainText && !state._postImageData) { toast("Add a photo or a caption first", "error"); return; }
  try {
    await api.addPost({ image: state._postImageData || null, caption: plainText ? captionHtml : "(no caption)" });
    state.posts = await api.getPosts().catch(() => state.posts);
    state._postImageData = null;
    state._postCaptionDraft = "";
    pushAutoNotification("New post shared", stripHtml(plainText ? captionHtml : "(no caption)"));
    toast("Posted! It's live on the Posts page now.", "success");
    render();
  } catch (e) {
    toast(e.message || "Couldn't publish post", "error");
  }
}

async function deletePost(id) {
  try {
    await api.deletePost(id);
    state.posts = state.posts.filter((p) => p.id !== id);
    toast("Post deleted");
    render();
  } catch (e) {
    toast(e.message || "Couldn't delete post", "error");
  }
}

/* ---- Admin: generic content manager (Live/Videos/Photos/Vlogs/Podcasts/Articles/Library/Programs/Services/Resources) ---- */
// Accepts a full playlist URL (youtube.com/playlist?list=..., a watch URL
// with &list=..., youtu.be links, etc.) or a bare playlist ID pasted
// directly, and returns just the ID — or null if nothing usable was found.
function extractYoutubePlaylistId(raw) {
  const input = (raw || "").trim();
  if (!input) return null;
  try {
    const url = new URL(input);
    const listParam = url.searchParams.get("list");
    if (listParam) return listParam;
  } catch (e) {
    // Not a full URL — fall through and treat it as a bare ID below.
  }
  if (/^[A-Za-z0-9_-]{10,}$/.test(input)) return input;
  return null;
}

function extractYoutubeVideoId(raw) {
  const input = (raw || "").trim();
  if (!input) return null;
  try {
    const url = new URL(input);
    const host = url.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      const id = url.pathname.split("/").filter(Boolean)[0];
      if (id) return id;
    }
    if (host === "youtube.com" || host === "m.youtube.com") {
      const vParam = url.searchParams.get("v");
      if (vParam) return vParam;
      const parts = url.pathname.split("/").filter(Boolean);
      // Handles /live/VIDEOID and /embed/VIDEOID style links
      if ((parts[0] === "live" || parts[0] === "embed") && parts[1]) return parts[1];
    }
  } catch (e) {
    // Not a full URL — fall through and treat it as a bare ID below.
  }
  if (/^[A-Za-z0-9_-]{10,15}$/.test(input)) return input;
  return null;
}

/* Called when a visitor taps "Watch now" on a live class. YouTube Live
   links play right in the site's media modal (public, no sign-in). Google
   Meet / Zoom links can't be embedded and usually require sign-in, so
   those just open in a new tab instead. */
function openLiveClass(id) {
  const item = state.liveClasses.find((c) => c.id === id);
  if (!item) return;

  if (!item.link) {
    toast("No stream link has been added for this class yet — check back soon", "error");
    return;
  }

  if (item.linkType === "external") {
    window.open(item.link, "_blank", "noopener,noreferrer");
    toast("Opening in Google Meet / Zoom — sign in there to join", "success");
    return;
  }

  // YouTube (default): embed inline if we can pull a video ID, otherwise
  // fall back to opening the link directly.
  const videoId = extractYoutubeVideoId(item.link);
  if (!videoId) {
    window.open(item.link, "_blank", "noopener,noreferrer");
    return;
  }
  document.getElementById("media-modal-title").textContent = item.title || "Live class";
  document.getElementById("media-modal").classList.remove("fullscreen");
  state._mediaModalType = "class";
  document.getElementById("media-modal-body").innerHTML = `
    <div class="media-modal-media" style="border-radius:12px;overflow:hidden;margin-bottom:14px;aspect-ratio:16/9;height:auto;background:none;">
      <iframe width="100%" height="100%" src="https://www.youtube.com/embed/${encodeURIComponent(videoId)}?autoplay=1"
        title="${escapeHtml(item.title || "Live class")}" frameborder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowfullscreen style="display:block;width:100%;height:100%;"></iframe>
    </div>
    <p style="font-size:13px;color:var(--color-text-muted);margin-bottom:4px;">${escapeHtml(item.host || "")}</p>
    <p style="font-size:12px;color:var(--color-text-soft);">📺 Streaming live on YouTube — open to everyone, no sign-in needed.</p>
  `;
  document.getElementById("media-modal-backdrop").classList.remove("hidden");
  updateMediaModalNavButtons();
}

function downloadResource(id, title) {
  const item = state.resources.find((r) => r.id === id);
  if (item && item.link) {
    window.open(item.link, "_blank", "noopener,noreferrer");
    return;
  }
  toast(`"${title}" download started`, "success");
}

async function addContentItem(typeKey) {
  const cfg = CONTENT_TYPES[typeKey];
  if (!cfg) return;
  const fields = {};
  let hasValue = false;
  cfg.fields.forEach(([key]) => {
    const el = document.getElementById(`content-field-${key}`);
    if (!el) { fields[key] = ""; return; }
    const val = key === "desc" ? sanitizeRichHtml(el.innerHTML) : el.value.trim();
    const plain = key === "desc" ? stripHtml(val) : val;
    fields[key] = val;
    if (plain) hasValue = true;
  });
  if (typeKey === "playlists") {
    const playlistId = extractYoutubePlaylistId(fields.url);
    if (!playlistId) { toast("Paste a valid YouTube playlist link or ID", "error"); return; }
    fields.playlistId = playlistId;
  }
  if (cfg.hasImage && state._contentImageDraftType === typeKey && state._contentImageDraft) {
    fields.image = state._contentImageDraft;
    hasValue = true;
  }
  if (cfg.hasFile && state._contentFileDraftType === typeKey && state._contentFileDraft) {
    fields.link = state._contentFileDraft;
    fields.fileName = state._contentFileDraftName;
    if (cfg.fields.some(([k]) => k === "size") && !fields.size) fields.size = formatFileSize(state._contentFileDraftSize);
    if (cfg.fields.some(([k]) => k === "type") && !fields.type) fields.type = "PDF";
    hasValue = true;
  }
  if (!hasValue) { toast("Fill in at least one field first", "error"); return; }
  if (cfg.hasLiveToggle) {
    const liveEl = document.getElementById("content-field-live");
    fields.live = liveEl ? liveEl.checked : false;
  }
  try {
    const item = await api.addContent(typeKey, fields);
    state[cfg.stateKey].push(item);
    state._contentImageDraft = null;
    state._contentImageDraftType = null;
    state._contentFileDraft = null;
    state._contentFileDraftName = null;
    state._contentFileDraftSize = null;
    state._contentFileDraftType = null;
    pushAutoNotification(`New ${cfg.label.replace(/s$/, "")} added`, cfg.summary(item));
    toast(`Added to ${cfg.label}`, "success");
    render();
  } catch (e) {
    toast(e.message || `Couldn't add to ${cfg.label}`, "error");
  }
}

async function deleteContentItem(typeKey, id) {
  const cfg = CONTENT_TYPES[typeKey];
  if (!cfg) return;
  try {
    await api.deleteContent(typeKey, id);
    state[cfg.stateKey] = state[cfg.stateKey].filter((i) => i.id !== id);
    toast(`Removed from ${cfg.label}`);
    render();
  } catch (e) {
    toast(e.message || `Couldn't remove from ${cfg.label}`, "error");
  }
}

async function toggleContentLive(typeKey, id) {
  const cfg = CONTENT_TYPES[typeKey];
  if (!cfg) return;
  const current = state[cfg.stateKey].find((i) => i.id === id);
  if (!current) return;
  try {
    const updated = await api.updateContent(typeKey, id, { live: !current.live });
    state[cfg.stateKey] = state[cfg.stateKey].map((i) => (i.id === id ? updated : i));
    render();
  } catch (e) {
    toast(e.message || "Couldn't update live status", "error");
  }
}

/* ---- Admin: CMS ---- */
function saveCmsFromForm() {
  const richKeys = new Set(["heroSub", "aboutText"]);
  const keys = ["heroTitle","heroSub","aboutText","missionText","contactAddress","contactPhone","contactEmail","whatsappNumber","seoTitle","seoDesc","seoKeywords"];
  keys.forEach((key) => {
    const el = document.getElementById(`cms-${key}`);
    if (!el) return;
    state.cms[key] = richKeys.has(key) ? sanitizeRichHtml(el.innerHTML) : el.value;
  });
  storageSet("cms-content", state.cms);
  toast("Content updated across the site", "success");
  render();
}

/* Login sessions are now a JWT token (see api.js) rather than a user
   object copied into localStorage/sessionStorage, so there's no separate
   "persist current user" step needed after a profile edit. */

async function saveProfileDetails() {
  const name = document.getElementById("profile-name").value.trim();
  const email = document.getElementById("profile-email").value.trim();
  const phone = document.getElementById("profile-phone").value.trim();
  if (!name || !email) { toast("Name and email can't be empty", "error"); return; }

  try {
    const user = await api.updateProfile({ name, email, phone });
    state.user = user;
    toast("Profile updated", "success");
    render();
  } catch (e) {
    toast(e.message || "Couldn't update your profile", "error");
  }
}

async function saveProfilePassword() {
  const current = document.getElementById("profile-current-password").value;
  const next = document.getElementById("profile-new-password").value;
  const confirm = document.getElementById("profile-confirm-password").value;

  if (!current || !next || !confirm) { toast("Fill in all three password fields", "error"); return; }
  if (next.length < 6) { toast("New password should be at least 6 characters", "error"); return; }
  if (next !== confirm) { toast("New passwords don't match", "error"); return; }

  try {
    await api.changePassword({ currentPassword: current, newPassword: next });
    document.getElementById("profile-current-password").value = "";
    document.getElementById("profile-new-password").value = "";
    document.getElementById("profile-confirm-password").value = "";
    toast("Password updated", "success");
  } catch (e) {
    toast(e.message || "Couldn't update your password", "error");
  }
}

/* ---- Admin: push notifications ---- */
function sendAdminNotification() {
  const title = document.getElementById("notif-title").value.trim();
  const body = document.getElementById("notif-body").value.trim();
  if (!title) { toast("Add a notification title", "error"); return; }
  const entry = { id: Math.random().toString(36).slice(2), title, body, time: new Date().toLocaleString() };
  state.notifications.push(entry);
  storageSet("notifications", state.notifications);
  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    try { new Notification(title, { body }); } catch (e) {}
  }
  toast("Notification sent to all visitors", "success");
  render();
}

/* ---- QR download ---- */
function downloadQr() {
  const img = document.getElementById("qr-img");
  const a = document.createElement("a");
  a.href = img.src;
  a.download = "sikhjagat-qr.png";
  a.target = "_blank";
  a.click();
  toast("QR code downloading...", "success");
}

/* ---- Auth: login / register / forgot password (stored in localStorage,
   demo only — not secure). Modes: "login", "register", "forgot" (enter
   email/phone), "otp" (enter the code), "reset" (choose a new password). ---- */
function openAuthModal(mode) {
  state._authMode = mode;
  renderAuthModalBody();
  document.getElementById("auth-modal-backdrop").classList.remove("hidden");
}

function renderAuthModalBody() {
  const mode = state._authMode;
  const titleEl = document.getElementById("auth-modal-title");
  const bodyEl = document.getElementById("auth-modal-body");

  if (mode === "login" || mode === "register") {
    titleEl.textContent = mode === "login" ? t().signIn : t().signUp;
    bodyEl.innerHTML = `
      <form id="auth-form" novalidate>
        ${mode === "register" ? `
          <div class="field">
            <label>${t().yourName}</label>
            <input id="auth-name" placeholder="Jasleen Kaur" autocomplete="name" />
          </div>` : ""}
        <div class="field">
          <label>${t().yourEmail}</label>
          <input id="auth-email" type="email" placeholder="you@example.com" autocomplete="email" />
        </div>
        ${mode === "register" ? `
          <div class="field">
            <label>Mobile number <span class="field-optional">(optional — used for password reset)</span></label>
            <input id="auth-phone" type="tel" placeholder="+91 98765 43210" autocomplete="tel" />
          </div>` : ""}
        <div class="field">
          <label>Password</label>
          <div class="input-with-action">
            <input id="auth-password" type="password" placeholder="••••••••"
              autocomplete="${mode === "login" ? "current-password" : "new-password"}" />
            <button type="button" class="input-action-btn" data-action="toggle-pw" data-target="auth-password" title="Show password">👁</button>
          </div>
        </div>
        ${mode === "login" ? `
          <div class="auth-row">
            <label class="checkbox-row">
              <input type="checkbox" id="auth-remember" checked />
              <span>Remember me</span>
            </label>
            <button type="button" class="link-btn small" data-action="open-forgot">Forgot password?</button>
          </div>` : ""}
        <button type="submit" class="btn btn-primary btn-block">${mode === "login" ? t().signIn : t().signUp}</button>
        <p class="auth-switch-line">
          ${mode === "login" ? t().noAccount : t().haveAccount}
          <button type="button" id="auth-switch-btn" class="auth-switch-btn">${mode === "login" ? t().signUp : t().signIn}</button>
        </p>
        <p class="auth-demo-note">
          Demo admin login — email <span class="mono">admin@sikhjagat.org</span>,
          password <span class="mono">admin123</span>. Works immediately, no registration needed.
        </p>
      </form>
    `;
    document.getElementById("auth-switch-btn").onclick = () => openAuthModal(mode === "login" ? "register" : "login");
    return;
  }

  if (mode === "forgot") {
    titleEl.textContent = "Reset your password";
    bodyEl.innerHTML = `
      <form id="forgot-form" novalidate>
        <p class="auth-help-text">Enter the email or mobile number on your account and we'll send you a one-time code to reset your password.</p>
        <div class="field">
          <label>Email or mobile number</label>
          <input id="forgot-identifier" placeholder="you@example.com or +91 98765 43210" autocomplete="username" />
        </div>
        <button type="submit" class="btn btn-primary btn-block">Send code</button>
        <p class="auth-switch-line">
          <button type="button" class="auth-switch-btn" data-action="back-to-login">← Back to sign in</button>
        </p>
      </form>
    `;
    return;
  }

  if (mode === "otp") {
    const rf = state._resetFlow || {};
    titleEl.textContent = "Enter the code";
    bodyEl.innerHTML = `
      <form id="otp-form" novalidate>
        <p class="auth-help-text">We sent a 6-digit code to <strong>${escapeHtml(maskIdentifier(rf.target, rf.method))}</strong>.</p>
        <div class="field">
          <label>One-time code</label>
          <input id="otp-code" class="otp-input" inputmode="numeric" maxlength="6" placeholder="••••••" autocomplete="one-time-code" />
        </div>
        <button type="submit" class="btn btn-primary btn-block">Verify code</button>
        <p class="auth-switch-line">
          Didn't get it? <button type="button" class="auth-switch-btn" data-action="resend-otp">Resend code</button>
        </p>
        <p class="auth-switch-line">
          <button type="button" class="auth-switch-btn" data-action="back-to-login">← Back to sign in</button>
        </p>
      </form>
    `;
    return;
  }

  if (mode === "reset") {
    titleEl.textContent = "Choose a new password";
    bodyEl.innerHTML = `
      <form id="reset-form" novalidate>
        <p class="auth-help-text">Your code checked out. Set a new password for your account.</p>
        <div class="field">
          <label>New password</label>
          <input id="reset-password" type="password" placeholder="At least 6 characters" autocomplete="new-password" />
        </div>
        <div class="field">
          <label>Confirm new password</label>
          <input id="reset-password-confirm" type="password" placeholder="••••••••" autocomplete="new-password" />
        </div>
        <button type="submit" class="btn btn-primary btn-block">Reset password</button>
      </form>
    `;
    return;
  }

  if (mode === "service") {
    const target = state._serviceRequestTarget || {};
    titleEl.textContent = `Request: ${target.title || "Service"}`;
    bodyEl.innerHTML = `
      <form id="service-request-form" novalidate>
        <p class="auth-help-text">Tell us a bit about what you need and someone from the team will reach out.</p>
        <div class="field">
          <label>Your name</label>
          <input id="service-req-name" placeholder="Jasleen Kaur" autocomplete="name" value="${escapeHtml(state.user ? state.user.name : "")}" />
        </div>
        <div class="field">
          <label>Email</label>
          <input id="service-req-email" type="email" placeholder="you@example.com" autocomplete="email" value="${escapeHtml(state.user ? state.user.email : "")}" />
        </div>
        <div class="field">
          <label>Phone <span class="field-optional">(optional)</span></label>
          <input id="service-req-phone" type="tel" placeholder="+91 98765 43210" autocomplete="tel" />
        </div>
        <div class="field">
          <label>Details <span class="field-optional">(optional)</span></label>
          <textarea id="service-req-note" rows="3" placeholder="Anything that helps us prepare…"></textarea>
        </div>
        <button type="submit" class="btn btn-primary btn-block">Send request</button>
      </form>
    `;
    return;
  }

}

function closeAuthModal() { document.getElementById("auth-modal-backdrop").classList.add("hidden"); }

/* ---- Service request modal ---- */
function openServiceRequestModal(id, title) {
  state._serviceRequestTarget = { id, title };
  openAuthModal("service");
}

async function submitServiceRequest() {
  const target = state._serviceRequestTarget;
  if (!target) return;
  const name = document.getElementById("service-req-name").value.trim();
  const email = document.getElementById("service-req-email").value.trim();
  const phone = document.getElementById("service-req-phone").value.trim();
  const note = document.getElementById("service-req-note").value.trim();
  if (!name || !email) { toast("Please add your name and email", "error"); return; }
  const message = `🛠️ Service request — ${target.title}${phone ? ` (📞 ${phone})` : ""}${note ? `: ${note}` : ""}`;
  try {
    await api.sendMessage({ name, email, message });
    state.contactMessages = await api.getMessages().catch(() => state.contactMessages);
    pushAdminAlert("🛠️", "New service request", `${name} requested "${target.title}"`);
    toast("Request sent — we'll be in touch soon", "success");
    closeAuthModal();
    render();
  } catch (e) {
    toast(e.message || "Couldn't send your request", "error");
  }
}

function togglePasswordVisibility(targetId) {
  const input = document.getElementById(targetId);
  if (!input) return;
  input.type = input.type === "password" ? "text" : "password";
}

async function submitAuthForm() {
  const mode = state._authMode;
  const email = document.getElementById("auth-email").value.trim();
  const password = document.getElementById("auth-password").value;
  const nameEl = document.getElementById("auth-name");
  const name = nameEl ? nameEl.value.trim() : "";
  const phoneEl = document.getElementById("auth-phone");
  const phone = phoneEl ? phoneEl.value.trim() : "";

  if (!email || !password) { toast("Enter your email and password", "error"); return; }
  if (mode === "register" && !name) { toast("Enter your name", "error"); return; }

  const submitBtn = document.querySelector("#auth-form button[type=submit]");
  if (submitBtn) submitBtn.disabled = true;

  try {
    if (mode === "register") {
      const user = await api.register({ name, email, password, phone });
      state.user = user;
      if (user.role !== "admin") pushAdminAlert("👤", "New member registered", `${user.name} (${user.email}) just created an account.`);
      toast(`Welcome to Sikh Jagat, ${user.name}!`, "success");
    } else {
      const remember = document.getElementById("auth-remember")?.checked !== false;
      const user = await api.login({ email, password, remember });
      state.user = user;
      toast(`${t().welcomeBack}, ${user.name}!`, "success");
    }
    closeAuthModal();
    render();
  } catch (e) {
    toast(e.message || "Something went wrong — please try again", "error");
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

function logout() {
  api.logout();
  state.user = null;
  toast("Logged out");
  navigate("home");
}

/* ---- Forgot password → OTP → reset flow ----
   This is a static demo site with no email/SMS backend (see README), so
   there's nowhere to actually deliver a code. To keep the flow honest
   rather than faking success, the "sent" code is shown directly in a
   toast — everything else (matching the account, expiring the code,
   checking it, updating the password) works exactly like a real one. */
function openForgotPassword() {
  state._resetFlow = null;
  openAuthModal("forgot");
}

function maskIdentifier(target, method) {
  if (!target) return "";
  if (method === "phone") {
    const digits = target.replace(/\D/g, "");
    if (digits.length <= 4) return target;
    return `${target.slice(0, 3)}${"•".repeat(Math.max(target.length - 6, 3))}${digits.slice(-2)}`;
  }
  const [user, domain] = target.split("@");
  if (!domain) return target;
  const visible = user.slice(0, 2);
  return `${visible}${"•".repeat(Math.max(user.length - 2, 3))}@${domain}`;
}

async function handleForgotSubmit() {
  const raw = document.getElementById("forgot-identifier").value.trim();
  if (!raw) { toast("Enter your email or mobile number", "error"); return; }
  try {
    const data = await api.forgotPassword(raw);
    state._resetFlow = {
      resetId: data.resetId || null,
      method: raw.includes("@") ? "email" : "phone",
      target: raw,
    };
    if (data.demoOtp) {
      // No email/SMS provider is wired up in this setup (see backend/routes/auth.js),
      // so the code is shown directly instead of pretending to send it.
      toast(`Demo mode: no real message is sent — your code is ${data.demoOtp}`, "info");
    } else {
      toast("If that account exists, a code has been sent", "info");
    }
    openAuthModal("otp");
  } catch (e) {
    toast(e.message || "Something went wrong — please try again", "error");
  }
}

function sendResetOtp() {
  // Re-trigger the same request as handleForgotSubmit (used by "Resend code").
  handleForgotSubmit();
}

async function handleOtpSubmit() {
  const rf = state._resetFlow;
  const code = document.getElementById("otp-code").value.trim();
  if (!rf || !rf.resetId) { toast("Something went wrong — please try again", "error"); openAuthModal("forgot"); return; }
  if (!code) { toast("Enter the code we sent you", "error"); return; }
  try {
    const data = await api.verifyResetOtp({ resetId: rf.resetId, code });
    rf.verifyToken = data.verifyToken;
    openAuthModal("reset");
  } catch (e) {
    toast(e.message || "Incorrect code", "error");
  }
}

async function handleResetSubmit() {
  const rf = state._resetFlow;
  if (!rf || !rf.verifyToken) { toast("Please verify your code first", "error"); openAuthModal("forgot"); return; }
  const pw1 = document.getElementById("reset-password").value;
  const pw2 = document.getElementById("reset-password-confirm").value;
  if (!pw1 || pw1.length < 6) { toast("Password should be at least 6 characters", "error"); return; }
  if (pw1 !== pw2) { toast("Passwords don't match", "error"); return; }
  try {
    await api.resetPassword({ verifyToken: rf.verifyToken, newPassword: pw1 });
    state._resetFlow = null;
    toast("Password reset — you can sign in now", "success");
    openAuthModal("login");
  } catch (e) {
    toast(e.message || "Something went wrong — please try again", "error");
  }
}

/* ---- Media detail modal: what opens when you click a photo/video/vlog/podcast/article ---- */
const MEDIA_STATE_KEYS = { video: "videos", photo: "photos", vlog: "vlogs", podcast: "podcasts", article: "articles", playlist: "playlists" };

/* ---- Engagement: live views/likes/shares/comments, per item, now backed
   by the server (see backend/routes/engagement.js) so the same counts show
   up for every visitor, not just this browser. state.engagement is a local
   read-through cache: { "type:id": { views, likeCount, likedByMe, shares,
   comments } }, refreshed after every interaction and pre-loaded in bulk
   at startup (see loadAllEngagement() in init()). ---- */
function engKey(type, id) { return `${type}:${id}`; }

const EMPTY_ENG = { views: 0, likeCount: 0, likedByMe: false, shares: 0, comments: [] };

// Read-only lookup for card grids — reads whatever's in the local cache;
// doesn't fabricate data and doesn't trigger a network request by itself.
function peekEng(type, id) {
  return state.engagement[engKey(type, id)] || EMPTY_ENG;
}
function getEng(type, id) { return peekEng(type, id); }

// Compact "👁 12 · ❤️ 3 · 💬 1" line used on card grids.
function engMini(type, id) {
  const e = peekEng(type, id);
  return `👁 ${e.views.toLocaleString()} · ❤️ ${e.likeCount} · 💬 ${e.comments.length}`;
}

function setEng(type, id, data, likedByMeOverride) {
  const prev = peekEng(type, id);
  state.engagement[engKey(type, id)] = {
    views: data.views, likeCount: data.likeCount, shares: data.shares, comments: data.comments,
    likedByMe: likedByMeOverride !== undefined ? likedByMeOverride : (data.likedByMe !== undefined ? data.likedByMe : prev.likedByMe),
  };
}

// Fetches engagement for every media item across every list, in parallel,
// so card grids have real counts to show without a request per card render.
async function loadAllEngagement() {
  const jobs = [];
  Object.entries(MEDIA_STATE_KEYS).forEach(([type, stateKey]) => {
    (state[stateKey] || []).forEach((item) => {
      jobs.push(
        api.getEngagement(type, item.id)
          .then((data) => setEng(type, item.id, data, data.likedByMe))
          .catch(() => {})
      );
    });
  });
  await Promise.all(jobs);
}

function isLikedByMe(type, id) { return peekEng(type, id).likedByMe; }

function trackView(type, id) {
  return api.trackView(type, id).then((data) => setEng(type, id, data)).catch(() => {});
}

async function toggleLike(type, id) {
  try {
    const data = await api.toggleLike(type, id);
    setEng(type, id, data, data.likedByMe);
    refreshMediaModalBody(type, id);
  } catch (e) {
    toast(e.message || "Couldn't update like", "error");
  }
}

async function shareItem(type, id) {
  const stateKey = MEDIA_STATE_KEYS[type];
  const item = state[stateKey] && state[stateKey].find((i) => i.id === id);
  try {
    const data = await api.shareItem(type, id);
    setEng(type, id, data);
  } catch (e) { /* share counter is best-effort — still let sharing itself proceed */ }
  const shareUrl = `${location.origin}${location.pathname}#${type}-${id}`;
  const title = item ? item.title : "Sikh Jagat";
  if (navigator.share) {
    navigator.share({ title, url: shareUrl }).catch(() => {});
  } else if (navigator.clipboard) {
    navigator.clipboard.writeText(shareUrl).then(() => toast("Link copied to clipboard!", "success")).catch(() => toast("Couldn't copy the link", "error"));
  } else {
    toast("Sharing isn't supported in this browser", "error");
  }
  refreshMediaModalBody(type, id);
}

async function addComment(type, id) {
  const input = document.getElementById("comment-input");
  const text = input ? input.value.trim() : "";
  if (!text) { toast("Write a comment before posting", "error"); return; }
  const name = state.user ? state.user.name : "Guest";
  try {
    const data = await api.addComment(type, id, { name, text });
    setEng(type, id, data);
    const stateKey = MEDIA_STATE_KEYS[type];
    const item = state[stateKey] && state[stateKey].find((i) => i.id === id);
    pushAdminAlert("💬", "New comment", `${name} commented on “${item ? item.title : type}”: “${text.slice(0, 80)}${text.length > 80 ? "…" : ""}”`);
    refreshMediaModalBody(type, id);
  } catch (e) {
    toast(e.message || "Couldn't post comment", "error");
  }
}

async function deleteComment(type, id, commentId) {
  try {
    const data = await api.deleteComment(type, id, commentId);
    setEng(type, id, data);
    refreshMediaModalBody(type, id);
  } catch (e) {
    toast(e.message || "Couldn't delete comment", "error");
  }
}

function renderEngagementHtml(type, id) {
  const eng = getEng(type, id);
  const liked = isLikedByMe(type, id);
  const isAdmin = state.user && state.user.role === "admin";
  return `
    <div class="engage-bar">
      <button class="engage-btn ${liked ? "liked" : ""}" data-action="toggle-like" data-type="${type}" data-id="${id}">${liked ? "❤️" : "🤍"} <span>${eng.likeCount}</span></button>
      <button class="engage-btn" data-action="share-item" data-type="${type}" data-id="${id}">🔗 Share${eng.shares ? ` <span>${eng.shares}</span>` : ""}</button>
      <span class="engage-views">👁 ${eng.views.toLocaleString()} view${eng.views === 1 ? "" : "s"}</span>
    </div>
    <div class="comments-section">
      <p style="font-weight:700;font-size:13px;margin-bottom:10px;">💬 Comments (${eng.comments.length})</p>
      <div class="field" style="margin-bottom:8px;">
        <textarea id="comment-input" rows="2" placeholder="Write a comment…"></textarea>
      </div>
      <button class="btn btn-primary" style="padding:7px 16px;font-size:12px;margin-bottom:12px;" data-action="add-comment" data-type="${type}" data-id="${id}">Post comment</button>
      ${eng.comments.length === 0 ? `<p style="font-size:12px;color:var(--color-text-soft);">Be the first to leave a review or comment.</p>` :
        `<div class="comment-list">${eng.comments.slice().reverse().map((c) => `
          <div class="comment-row">
            <div style="display:flex;justify-content:space-between;gap:8px;">
              <span style="font-weight:700;font-size:12px;">${escapeHtml(c.name)}</span>
              <span style="font-size:10px;color:var(--color-text-soft);white-space:nowrap;">${escapeHtml(c.time)}</span>
            </div>
            <p style="font-size:13px;margin-top:2px;">${escapeHtml(c.text)}</p>
            ${isAdmin ? `<button data-action="delete-comment" data-type="${type}" data-id="${id}" data-comment-id="${c.id}" style="font-size:11px;color:var(--color-error);margin-top:4px;">🗑 Remove</button>` : ""}
          </div>`).join("")}</div>`}
    </div>
  `;
}

// Re-renders just the engagement/comments part of an already-open media
// modal (used after like/share/comment) so the modal doesn't need to
// close and reopen.
function refreshMediaModalBody(type, id) {
  const el = document.getElementById(`engagement-slot-${type}-${id}`);
  if (el) el.innerHTML = renderEngagementHtml(type, id);
}

function openMediaModal(type, id) {
  const stateKey = MEDIA_STATE_KEYS[type];
  const item = stateKey && state[stateKey].find((i) => i.id === id);
  if (!item) return;

  document.getElementById("media-modal-title").textContent = item.title || "";
  document.getElementById("media-modal").classList.remove("fullscreen");
  state._mediaModalType = type;
  state._mediaModalId = id;
  trackView(type, id).then(() => refreshMediaModalBody(type, id));

  let html = "";
  if (type === "photo") {
    html = item.image
      ? `<img src="${item.image}" style="width:100%;border-radius:12px;margin-bottom:14px;display:block;" alt="" />`
      : `<div class="media-modal-media" style="height:220px;border-radius:12px;background:linear-gradient(135deg,#fb923c,#be123c);display:flex;align-items:center;justify-content:center;font-size:44px;color:white;margin-bottom:14px;">🖼️</div>`;
    html += `<p style="font-size:13px;color:var(--color-text-muted);">${escapeHtml(item.count || "")}</p>`;
    if (item.link) html += `<button class="btn btn-outline" data-action="open-link" data-link="${escapeHtml(item.link)}" style="margin-top:12px;">🔗 Open full album</button>`;
  } else if (type === "video" || type === "vlog") {
    const videoId = item.link ? extractYoutubeVideoId(item.link) : null;
    html = videoId ? `
      <div class="media-modal-media" style="border-radius:12px;overflow:hidden;margin-bottom:14px;aspect-ratio:16/9;height:auto;background:none;">
        <iframe width="100%" height="100%" src="https://www.youtube.com/embed/${encodeURIComponent(videoId)}"
          title="${escapeHtml(item.title || "")}" frameborder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowfullscreen style="display:block;width:100%;height:100%;"></iframe>
      </div>
    ` : `
      <div class="media-modal-media" style="height:220px;border-radius:12px;background:linear-gradient(135deg,#be123c,#ea580c);display:flex;align-items:center;justify-content:center;font-size:52px;color:white;margin-bottom:14px;">▶</div>
    `;
    html += `
      <p style="font-size:13px;color:var(--color-text-muted);">${[item.author, item.cat, item.dur, item.views ? `👁 ${item.views}` : ""].filter(Boolean).map(escapeHtml).join(" · ")}</p>
      ${videoId ? "" : `
        <p style="font-size:12px;color:var(--color-text-soft);margin-top:12px;padding-top:12px;border-top:1px solid var(--color-border);">${item.link ? "This link couldn't be recognized as YouTube — try opening it directly:" : "This is a demo site — connect a real video host (YouTube, Vimeo, etc.) to play actual footage here."}</p>
        ${item.link ? `<button class="btn btn-outline" data-action="open-link" data-link="${escapeHtml(item.link)}" style="margin-top:8px;">🔗 Open link</button>` : ""}
      `}
      <p class="mobile-only" style="font-size:12px;color:var(--color-text-soft);margin-top:8px;">📱 Turn your phone sideways, or tap ⛶ above, for a bigger view.</p>
    `;
  } else if (type === "podcast") {
    html = `
      <div class="media-modal-media" style="height:120px;border-radius:12px;background:var(--color-primary);display:flex;align-items:center;justify-content:center;font-size:40px;color:white;margin-bottom:14px;">🎙️</div>
      <p style="font-size:13px;color:var(--color-text-muted);">${[item.guest, item.dur].filter(Boolean).map(escapeHtml).join(" · ")}</p>
      ${item.link
        ? `<button class="btn btn-outline" data-action="open-link" data-link="${escapeHtml(item.link)}" style="margin-top:12px;">🔗 Listen — opens in a new tab</button>`
        : `<p style="font-size:12px;color:var(--color-text-soft);margin-top:12px;padding-top:12px;border-top:1px solid var(--color-border);">This is a demo site — connect a real audio host to play the episode here.</p>`}
    `;
  } else if (type === "article") {
    html = `
      <p style="font-size:12px;color:var(--color-text-soft);margin-bottom:14px;">${[item.author, item.read].filter(Boolean).map(escapeHtml).join(" · ")}</p>
      <p style="font-size:14px;line-height:1.7;color:var(--color-text-muted);">${escapeHtml(item.body || "Full article text isn't in this demo yet — add a body field in the admin Articles tab to show it here.")}</p>
      ${item.link ? `<button class="btn btn-outline" data-action="open-link" data-link="${escapeHtml(item.link)}" style="margin-top:12px;">🔗 Read full article</button>` : ""}
    `;
  } else if (type === "playlist") {
    html = `
      <div class="media-modal-media" style="border-radius:12px;overflow:hidden;margin-bottom:14px;aspect-ratio:16/9;height:auto;background:none;">
        <iframe width="100%" height="100%" src="https://www.youtube.com/embed/videoseries?list=${encodeURIComponent(item.playlistId)}"
          title="${escapeHtml(item.title || "YouTube playlist")}" frameborder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowfullscreen style="display:block;width:100%;height:100%;"></iframe>
      </div>
      <p style="font-size:12px;color:var(--color-text-soft);">📺 Live playlist from YouTube — plays right here, no separate app needed.</p>
    `;
  }
  html += `<div id="engagement-slot-${type}-${id}">${renderEngagementHtml(type, id)}</div>`;
  document.getElementById("media-modal-body").innerHTML = html;
  document.getElementById("media-modal-backdrop").classList.remove("hidden");
  updateMediaModalNavButtons();
}

/* Shows/hides the ‹ › buttons in the media modal header: only relevant
   when the current item belongs to a browsable list (video, photo, etc.)
   with more than one item in it. */
function updateMediaModalNavButtons() {
  const stateKey = MEDIA_STATE_KEYS[state._mediaModalType];
  const show = !!stateKey && state[stateKey].length > 1;
  document.getElementById("media-modal-prev").classList.toggle("hidden", !show);
  document.getElementById("media-modal-next").classList.toggle("hidden", !show);
}

/* Steps to the next/previous item within the same content type, following
   the same newest-first order the grid/list pages already display. Wraps
   around at either end. direction is +1 (next) or -1 (previous). */
function navigateMediaModal(direction) {
  const type = state._mediaModalType;
  const stateKey = MEDIA_STATE_KEYS[type];
  if (!stateKey) return;
  const list = state[stateKey].slice().reverse();
  if (list.length < 2) return;
  const idx = list.findIndex((i) => i.id === state._mediaModalId);
  if (idx === -1) return;
  const nextIdx = (idx + direction + list.length) % list.length;
  openMediaModal(type, list[nextIdx].id);
}

function closeMediaModal() {
  document.getElementById("media-modal-backdrop").classList.add("hidden");
  document.getElementById("media-modal").classList.remove("fullscreen");
  if (document.fullscreenElement) {
    try { document.exitFullscreen(); } catch (e) {}
  }
  if (screen.orientation && screen.orientation.unlock) {
    try { screen.orientation.unlock(); } catch (e) {}
  }
  state._mediaModalType = null;
  state._mediaModalId = null;

  // If this modal was opened by clicking a search result, re-flash the
  // highlight on its card now that the modal is out of the way — otherwise
  // the flash from goToSearchResult() already faded while the modal was open,
  // and the user closes it back into a grid with no clue which item it was.
  if (state._searchTarget) {
    const { id, mediaType } = state._searchTarget;
    state._searchTarget = null;
    // openModalType is intentionally omitted — this second flash is purely a
    // visual reminder of which card matched, not another trigger to reopen it.
    flashSearchHighlight(id, mediaType, null);
  }
}

async function toggleMediaModalFullscreen() {
  const modal = document.getElementById("media-modal");
  const goingFullscreen = !modal.classList.contains("fullscreen");
  modal.classList.toggle("fullscreen", goingFullscreen);

  if (!goingFullscreen) {
    if (document.fullscreenElement) {
      try { await document.exitFullscreen(); } catch (e) {}
    }
    if (screen.orientation && screen.orientation.unlock) {
      try { screen.orientation.unlock(); } catch (e) {}
    }
    return;
  }

  // For video/vlog content, also try the real Fullscreen API so the phone's
  // browser chrome gets out of the way, then lock to landscape so it rotates
  // into a proper widescreen view. Both are optional — if the browser
  // doesn't support or allow them, the CSS fullscreen class above still
  // gives a full-viewport view either way.
  const isVideoType = state._mediaModalType === "video" || state._mediaModalType === "vlog";
  if (isVideoType && modal.requestFullscreen) {
    try {
      await modal.requestFullscreen();
      if (screen.orientation && screen.orientation.lock) {
        try { await screen.orientation.lock("landscape"); } catch (e) { /* not supported on this device/browser — that's fine */ }
      }
    } catch (e) { /* fullscreen request blocked — CSS fullscreen still applies */ }
  }
}

// If someone is watching a video/vlog and physically rotates their phone to
// landscape, expand the modal to fill the screen automatically.
window.addEventListener("orientationchange", () => {
  const backdrop = document.getElementById("media-modal-backdrop");
  if (!backdrop || backdrop.classList.contains("hidden")) return;
  if (state._mediaModalType !== "video" && state._mediaModalType !== "vlog") return;
  if (window.matchMedia("(orientation: landscape)").matches) {
    document.getElementById("media-modal").classList.add("fullscreen");
  }
});

// Keep the fullscreen toggle in sync if the person exits fullscreen using
// their browser/OS back gesture instead of our ✕ button.
document.addEventListener("fullscreenchange", () => {
  if (!document.fullscreenElement) {
    const modal = document.getElementById("media-modal");
    if (modal) modal.classList.remove("fullscreen");
    if (screen.orientation && screen.orientation.unlock) {
      try { screen.orientation.unlock(); } catch (e) {}
    }
  }
});

/* ---- Push notification permission banner ---- */
function initPushBanner() {
  const banner = document.getElementById("push-banner");
  if (typeof Notification === "undefined" || Notification.permission !== "default") return;
  banner.classList.remove("hidden");
  document.getElementById("push-enable-btn").onclick = async () => {
    try {
      const p = await Notification.requestPermission();
      if (p === "granted") toast("Push notifications enabled", "success");
      banner.classList.add("hidden");
    } catch (e) { toast("Couldn't enable notifications in this browser", "error"); }
  };
  document.getElementById("push-dismiss-btn").onclick = () => banner.classList.add("hidden");
}

/* ---- Active users ("X online now") ----
   There's no server here, so this can't see visitors on other computers —
   only other tabs/windows open in THIS browser. It works by having every
   tab write a "heartbeat" timestamp to localStorage every few seconds under
   its own random session ID. Any heartbeat older than 12 seconds is treated
   as a closed tab and gets swept away. Other tabs on the same machine will
   correctly show up in the count (try opening this site in two tabs).
   For a real "how many people are on the site right now" feature across
   different visitors/devices, you'd need a small backend that tracks open
   WebSocket connections (or a service like Firebase Realtime Database /
   Supabase Presence) — localStorage simply isn't shared between computers. */
const PRESENCE_PREFIX = "presence:";
const PRESENCE_TTL_MS = 12000;
const PRESENCE_HEARTBEAT_MS = 4000;
const sessionId = Math.random().toString(36).slice(2);

function computeActiveUsers() {
  const now = Date.now();
  let count = 0;
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(PREFIX + PRESENCE_PREFIX)) continue;
    let ts = 0;
    try { ts = JSON.parse(localStorage.getItem(key)); } catch (e) { ts = 0; }
    if (now - ts > PRESENCE_TTL_MS) { localStorage.removeItem(key); }
    else { count++; }
  }
  return Math.max(count, 1); // always count yourself
}

function updateActiveNowUI() {
  state.activeUsers = computeActiveUsers();
  const badge = document.getElementById("active-now");
  if (badge) badge.innerHTML = `<span class="presence-dot"></span> ${state.activeUsers} online now`;
  const statEl = document.getElementById("stat-active-now");
  if (statEl) statEl.textContent = state.activeUsers;
}

function initPresence() {
  const heartbeat = () => {
    storageSet(PRESENCE_PREFIX + sessionId, Date.now());
    updateActiveNowUI();
  };
  heartbeat();
  setInterval(heartbeat, PRESENCE_HEARTBEAT_MS);
  // when another tab writes/removes a heartbeat, this event fires here too —
  // use it to refresh the count without waiting for our own next heartbeat
  window.addEventListener("storage", (e) => {
    if (e.key && e.key.startsWith(PREFIX + PRESENCE_PREFIX)) updateActiveNowUI();
  });
  window.addEventListener("beforeunload", () => {
    localStorage.removeItem(PREFIX + PRESENCE_PREFIX + sessionId);
  });
}

/* --------------------------- BIND STATIC EVENTS + BOOTSTRAP --------------------------- */
function bindStaticEvents() {
  initPushBanner();
}

document.addEventListener("DOMContentLoaded", init);