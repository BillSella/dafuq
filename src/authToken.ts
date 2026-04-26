const ACCESS = "dafuq_access_token";
const REFRESH = "dafuq_refresh_token";

type JwtPayload = Record<string, unknown>;

function normalizeClaimValue(value: unknown): string[] {
  if (typeof value === "string") {
    return value
      .split(" ")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0);
  }
  return [];
}

function decodeJwtPayload(token: string): JwtPayload | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const payload = parts[1]
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(Math.ceil(parts[1].length / 4) * 4, "=");
    const json = window.atob(payload);
    const parsed = JSON.parse(json) as unknown;
    if (typeof parsed !== "object" || parsed === null) return null;
    return parsed as JwtPayload;
  } catch {
    return null;
  }
}

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
 * Reads normalized JWT claims from the access token payload.
 * Supports common providers: `scope`, `scp`, `roles`, and `permissions`.
 */
export function getAccessTokenClaims(): string[] {
  const token = getAccessToken();
  if (!token || typeof window === "undefined") return [];
  const payload = decodeJwtPayload(token);
  if (!payload) return [];
  const claims = [
    ...normalizeClaimValue(payload.scope),
    ...normalizeClaimValue(payload.scp),
    ...normalizeClaimValue(payload.roles),
    ...normalizeClaimValue(payload.permissions)
  ];
  return [...new Set(claims)];
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
