import {
  type DashboardBreakpoint,
  type DashboardDoc,
  normalizeDashboardDoc
} from "./dashboardStore";
import { getAccessToken } from "../../authToken";

type DashboardsEnvelope = {
  version?: number;
  dashboards: unknown[];
};

/**
 * Server sync helpers for dashboard CRUD/rollback endpoints.
 *
 * State modification contract:
 * - Source of truth: server-side dashboard documents accessed via `/api/v1/dashboards*`.
 * - Mutation paths:
 *   - `saveDashboardsToServer` persists full dashboard envelope.
 *   - `rollbackDashboardToVersion` requests server-side rollback and returns normalized doc.
 * - Guard behavior:
 *   - all operations short-circuit when no access token is available
 *   - invalid or non-OK responses return `null`/`false` instead of throwing
 */

const apiPath = "/api/v1/dashboards";
const versionsApiPath = (dashboardId: string) =>
  `/api/v1/dashboards/${encodeURIComponent(dashboardId)}/versions`;
const rollbackApiPath = (dashboardId: string) =>
  `/api/v1/dashboards/${encodeURIComponent(dashboardId)}/rollback`;

/**
 * Fetches dashboard documents from the Go server. Returns null if unauthenticated
 * or the request fails; otherwise returns the normalized list (may be empty).
 */
export async function fetchDashboardsFromServer(
  breakpointIds: DashboardBreakpoint[]
): Promise<DashboardDoc[] | null> {
  const token = getAccessToken();
  if (!token) return null;
  const res = await fetch(apiPath, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }
  });
  if (!res.ok) {
    return null;
  }
  const data = (await res.json()) as DashboardsEnvelope;
  if (!data || !Array.isArray(data.dashboards)) {
    return null;
  }
  return data.dashboards
    .map((d) => normalizeDashboardDoc(d as DashboardDoc, breakpointIds))
    .filter(
      (d): d is NonNullable<typeof d> => !!d?.id && !!d?.name && Array.isArray(d.widgets)
    );
}

/**
 * Persists the full dashboard list to the server. No-op if not authenticated.
 * Returns true on HTTP 2xx.
 */
export async function saveDashboardsToServer(docs: DashboardDoc[]): Promise<boolean> {
  const token = getAccessToken();
  if (!token) return false;
  const body = { version: 1, dashboards: docs };
  const res = await fetch(apiPath, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  return res.ok;
}

export async function fetchDashboardVersionsFromServer(dashboardId: string): Promise<string[] | null> {
  const token = getAccessToken();
  if (!token) return null;
  const res = await fetch(versionsApiPath(dashboardId), {
    method: "GET",
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { versions?: Array<{ timestamp?: string }> };
  if (!Array.isArray(data?.versions)) return [];
  return data.versions
    .map((v) => (typeof v.timestamp === "string" ? v.timestamp : ""))
    .filter((value) => value.length > 0)
    .slice(0, 10);
}

/**
 * Requests rollback to a historical dashboard snapshot and normalizes the response.
 */
export async function rollbackDashboardToVersion(
  dashboardId: string,
  timestamp: string,
  breakpointIds: DashboardBreakpoint[]
): Promise<DashboardDoc | null> {
  const token = getAccessToken();
  if (!token) return null;
  const res = await fetch(rollbackApiPath(dashboardId), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ timestamp })
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { dashboard?: unknown };
  if (!data || !data.dashboard) return null;
  const normalized = normalizeDashboardDoc(data.dashboard as DashboardDoc, breakpointIds);
  if (!normalized?.id || !normalized?.name || !Array.isArray(normalized.widgets)) {
    return null;
  }
  return normalized;
}
