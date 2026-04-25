const ACCESS = "dafuq_access_token";
const REFRESH = "dafuq_refresh_token";

/**
 * OAuth token storage helpers for browser-based auth state.
 *
 * State modification contract:
 * - Source of truth: token values in `window.localStorage`.
 * - Mutation paths: `setAccessToken`, `setRefreshToken`, `clearAuthTokens`,
 *   and `captureOAuthTokensFromUrl`.
 * - Guard behavior: read helpers return `null` on non-browser runtimes.
 */
/**
 * Reads the access token from localStorage.
 */
export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACCESS);
}

/**
 * Reads the refresh token from localStorage.
 */
export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(REFRESH);
}

/**
 * Persists an access token into localStorage.
 */
export function setAccessToken(token: string) {
  window.localStorage.setItem(ACCESS, token);
}

/**
 * Persists a refresh token into localStorage.
 */
export function setRefreshToken(token: string) {
  window.localStorage.setItem(REFRESH, token);
}

/**
 * Removes both access and refresh tokens from localStorage.
 */
export function clearAuthTokens() {
  window.localStorage.removeItem(ACCESS);
  window.localStorage.removeItem(REFRESH);
}

/**
 * Captures access_token / refresh_token from the URL hash (OAuth callback)
 * and stores them, then removes the hash from the location bar.
 */
export function captureOAuthTokensFromUrl() {
  if (typeof window === "undefined" || !window.location.hash) return;
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const at = params.get("access_token");
  const rt = params.get("refresh_token");
  if (at) setAccessToken(at);
  if (rt) setRefreshToken(rt);
  if (!at && !rt) return;
  const u = new URL(window.location.href);
  u.hash = "";
  window.history.replaceState(null, "", `${u.pathname}${u.search}${u.hash}`);
}
