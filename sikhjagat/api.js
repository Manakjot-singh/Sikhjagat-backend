/* =====================================================================
   API.JS — talks to the backend in /backend instead of localStorage for
   anything security- or shared-data-sensitive: accounts/passwords, content
   the admin uploads, and engagement (views/likes/shares/comments) that's
   supposed to be the same for every visitor, not just this browser.

   Purely local UI preferences (dark mode, language, which page you're on)
   still live in storage.js/localStorage — no need for a server round-trip
   for those.
   ===================================================================== */

const API_BASE = window.SIKHJAGAT_API_BASE || "http://localhost:8787/api";
const TOKEN_KEY = "sikhjagat:token";

function getToken() { return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY); }
function setToken(token, remember = true) {
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  if (!token) return;
  if (remember) localStorage.setItem(TOKEN_KEY, token);
  else sessionStorage.setItem(TOKEN_KEY, token);
}

// A stable per-browser id for guests (no account) to like/comment without
// duplicate-liking. Not sensitive — just a random string, not tied to identity.
function getDeviceId() {
  let id = localStorage.getItem("sikhjagat:deviceId");
  if (!id) {
    id = Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem("sikhjagat:deviceId", id);
  }
  return id;
}

async function apiRequest(path, { method = "GET", body, auth = true } = {}) {
  const headers = { "Content-Type": "application/json", "X-Device-Id": getDeviceId() };
  const token = getToken();
  if (auth && token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    throw new Error("Can't reach the server — check your connection and try again");
  }

  let data = null;
  try { data = await res.json(); } catch (e) { /* empty body is fine */ }

  if (!res.ok) {
    if (res.status === 401) setToken(null); // stale/expired session — clear it
    throw new Error((data && data.error) || `Request failed (${res.status})`);
  }
  return data;
}

const api = {
  /* ---- auth ---- */
  async register({ name, email, password, phone }) {
    const data = await apiRequest("/auth/register", { method: "POST", body: { name, email, password, phone }, auth: false });
    setToken(data.token);
    return data.user;
  },
  async login({ email, password, remember = true }) {
    const data = await apiRequest("/auth/login", { method: "POST", body: { email, password }, auth: false });
    setToken(data.token, remember);
    return data.user;
  },
  async me() {
    if (!getToken()) return null;
    try {
      const data = await apiRequest("/auth/me");
      return data.user;
    } catch (e) {
      return null; // expired/invalid token — treat as signed out
    }
  },
  logout() { setToken(null); },
  forgotPassword(identifier) {
    return apiRequest("/auth/forgot", { method: "POST", body: { identifier }, auth: false });
  },
  verifyResetOtp({ resetId, code }) {
    return apiRequest("/auth/verify-otp", { method: "POST", body: { resetId, code }, auth: false });
  },
  resetPassword({ verifyToken, newPassword }) {
    return apiRequest("/auth/reset-password", { method: "POST", body: { verifyToken, newPassword }, auth: false });
  },

  /* ---- account management ---- */
  listUsers() { return apiRequest("/users").then((d) => d.users); }, // admin only
  async updateProfile({ name, email, phone }) {
    const data = await apiRequest("/users/me", { method: "PUT", body: { name, email, phone } });
    setToken(data.token); // email may have changed, which is part of the token
    return data.user;
  },
  changePassword({ currentPassword, newPassword }) {
    return apiRequest("/users/me/password", { method: "PUT", body: { currentPassword, newPassword } });
  },

  /* ---- content (programs, services, videos, photos, etc.) ---- */
  listContent(type) {
    return apiRequest(`/content/${type}`, { auth: false }).then((d) => d.items);
  },
  addContent(type, fields) {
    return apiRequest(`/content/${type}`, { method: "POST", body: fields }).then((d) => d.item);
  },
  updateContent(type, id, fields) {
    return apiRequest(`/content/${type}/${id}`, { method: "PUT", body: fields }).then((d) => d.item);
  },
  deleteContent(type, id) {
    return apiRequest(`/content/${type}/${id}`, { method: "DELETE" });
  },

  /* ---- engagement (views/likes/shares/comments) ---- */
  getEngagement(type, id) { return apiRequest(`/engagement/${type}/${id}`, { auth: false }); },
  trackView(type, id) { return apiRequest(`/engagement/${type}/${id}/view`, { method: "POST", auth: false }); },
  toggleLike(type, id) { return apiRequest(`/engagement/${type}/${id}/like`, { method: "POST" }); },
  shareItem(type, id) { return apiRequest(`/engagement/${type}/${id}/share`, { method: "POST", auth: false }); },
  addComment(type, id, { name, text }) {
    return apiRequest(`/engagement/${type}/${id}/comments`, { method: "POST", body: { name, text } });
  },
  deleteComment(type, id, commentId) {
    return apiRequest(`/engagement/${type}/${id}/comments/${commentId}`, { method: "DELETE" });
  },

  /* ---- messages / feedback / posts / notifications / cms / bookmarks ---- */
  getMessages() { return apiRequest("/messages").then((d) => d.messages); },
  sendMessage(payload) { return apiRequest("/messages", { method: "POST", body: payload, auth: false }); },
  replyToMessage(id, reply) { return apiRequest(`/messages/${id}/reply`, { method: "POST", body: { reply } }).then((d) => d.message); },
  deleteMessage(id) { return apiRequest(`/messages/${id}`, { method: "DELETE" }); },
  getFeedback() { return apiRequest("/feedback").then((d) => d.feedback); }, // admin only
  sendFeedback(payload) { return apiRequest("/feedback", { method: "POST", body: payload }); },
  getPosts() { return apiRequest("/posts", { auth: false }).then((d) => d.posts); },
  addPost(payload) { return apiRequest("/posts", { method: "POST", body: payload }); },
  deletePost(id) { return apiRequest(`/posts/${id}`, { method: "DELETE" }); },
  getNotifications() { return apiRequest("/notifications", { auth: false }).then((d) => d.notifications); },
  getAdminAlerts() { return apiRequest("/admin-alerts").then((d) => d.alerts); },
  getCms() { return apiRequest("/cms", { auth: false }).then((d) => d.cms); },
  saveCms(updates) { return apiRequest("/cms", { method: "PUT", body: updates }); },
  getBookmarks() { return apiRequest("/bookmarks").then((d) => d.bookmarks); },
  addBookmark(itemId, type, title) { return apiRequest("/bookmarks", { method: "POST", body: { itemId, type, title } }); },
  removeBookmark(itemId) { return apiRequest(`/bookmarks/${itemId}`, { method: "DELETE" }); },
};
