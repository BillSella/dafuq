import {
  type DashboardBreakpoint,
  type DashboardDoc,
  normalizeDashboardDoc
} from "./dashboardStore";
import { getAccessToken } from "./authToken";

type DashboardsEnvelope = {
  version?: number;
  dashboards: unknown[];
};

const apiPath = "/api/v1/dashboards";

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
