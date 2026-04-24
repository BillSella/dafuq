const ACCESS = "dafuq_access_token";
const REFRESH = "dafuq_refresh_token";

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACCESS);
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(REFRESH);
}

export function setAccessToken(token: string) {
  window.localStorage.setItem(ACCESS, token);
}

export function setRefreshToken(token: string) {
  window.localStorage.setItem(REFRESH, token);
}

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
