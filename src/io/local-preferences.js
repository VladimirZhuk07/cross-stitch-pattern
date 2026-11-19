// Small user preferences (e.g. which side panels are folded) in the browser's localStorage.
// Preferences are optional comfort: when storage is missing, disabled or full, the app works
// with its defaults and tells nobody (openspec/specs/responsive-layout/spec.md, "Folded state
// is remembered across page loads"). Every access is wrapped because browsers throw here: a
// SecurityError when storage is blocked, a QuotaExceededError when it is full.
// Keys must be namespaced: on GitHub Pages all of a user's sites share one origin.

/**
 * Reads the stored text of a preference.
 * key  the localStorage key
 * Returns the stored string, or null when nothing is stored or storage cannot be read.
 */
export function readPreference(key) {
  try {
    return globalThis.localStorage.getItem(key);
  } catch {
    // Storage unavailable: behave as if nothing were stored (see the header comment).
    return null;
  }
}

/**
 * Stores the text of a preference.
 * key   the localStorage key
 * text  the string to store
 * Returns true when it was stored, false when storage cannot be written.
 */
export function writePreference(key, text) {
  try {
    globalThis.localStorage.setItem(key, text);
    return true;
  } catch {
    // Storage unavailable: the preference lasts only for this page (see the header comment).
    return false;
  }
}
