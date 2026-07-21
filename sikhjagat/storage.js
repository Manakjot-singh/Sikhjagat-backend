/* =====================================================================
   STORAGE.JS — thin wrapper around localStorage.
   Everything the app saves (dark mode, bookmarks, CMS text, users, etc.)
   goes through these two functions so it's all in one place.
   ===================================================================== */

const PREFIX = "sikhjagat:";

function storageGet(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch (e) {
    return fallback;
  }
}

function storageSet(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch (e) {
    return false;
  }
}

function storageRemove(key) {
  try {
    localStorage.removeItem(PREFIX + key);
    return true;
  } catch (e) {
    return false;
  }
}

/* Session-scoped versions — used for "Remember me": when a user signs in
   without checking it, we keep them logged in for this browser tab only
   (sessionStorage), instead of persisting across visits (localStorage). */
function storageGetSession(key, fallback) {
  try {
    const raw = sessionStorage.getItem(PREFIX + key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch (e) {
    return fallback;
  }
}

function storageSetSession(key, value) {
  try {
    sessionStorage.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch (e) {
    return false;
  }
}

function storageRemoveSession(key) {
  try {
    sessionStorage.removeItem(PREFIX + key);
    return true;
  } catch (e) {
    return false;
  }
}
