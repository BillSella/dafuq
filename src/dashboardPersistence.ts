import {
  DASHBOARD_INDEX_STORAGE_KEY,
  createDashboardDoc,
  makeDashboardStorageKey,
  normalizeDashboardDoc,
  type DashboardBreakpoint,
  type DashboardDoc
} from "./dashboardStore";

/**
 * LocalStorage persistence helpers for dashboard documents.
 *
 * State modification contract:
 * - Source of truth: dashboard docs in caller state, mirrored to localStorage.
 * - Mutation paths:
 *   - `persistDashboardsToStorage` writes index + per-dashboard payloads.
 *   - `clearPersistedDashboards` removes stored index and payloads.
 * - Guard behavior:
 *   - non-browser runtimes return defaults/no-op
 *   - malformed storage payloads degrade to defaults
 */

/**
 * Returns default dashboard list when no persisted data is available.
 */
export function createDefaultDashboards(breakpointIds: DashboardBreakpoint[]): DashboardDoc[] {
  void breakpointIds;
  return [];
}

/**
 * Hydrates dashboard documents from localStorage and normalizes each document.
 *
 * Falls back to defaults on missing index or malformed payloads.
 */
export function loadDashboardsFromStorage(breakpointIds: DashboardBreakpoint[]): DashboardDoc[] {
  if (typeof window === "undefined") {
    return createDefaultDashboards(breakpointIds);
  }
  try {
    const storedIndex = window.localStorage.getItem(DASHBOARD_INDEX_STORAGE_KEY);
    if (!storedIndex) {
      return createDefaultDashboards(breakpointIds);
    }
    const dashboardIds = JSON.parse(storedIndex) as string[];
    const loaded = dashboardIds
      .map((id) => window.localStorage.getItem(makeDashboardStorageKey(id)))
      .filter((raw): raw is string => !!raw)
      .map((raw) => normalizeDashboardDoc(JSON.parse(raw) as DashboardDoc, breakpointIds))
      .filter((doc) => !!doc?.id && !!doc?.name && Array.isArray(doc.widgets));
    return loaded.length > 0 ? loaded : createDefaultDashboards(breakpointIds);
  } catch {
    return createDefaultDashboards(breakpointIds);
  }
}

/**
 * Persists dashboard index and per-dashboard JSON payloads to localStorage.
 */
export function persistDashboardsToStorage(docs: DashboardDoc[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      DASHBOARD_INDEX_STORAGE_KEY,
      JSON.stringify(docs.map((doc) => doc.id))
    );
    docs.forEach((doc) => {
      window.localStorage.setItem(makeDashboardStorageKey(doc.id), JSON.stringify(doc, null, 2));
    });
  } catch {
    // Ignore storage quota/availability errors; UI state still remains in-memory.
  }
}

/**
 * Removes persisted dashboard index and document payload entries.
 */
export function clearPersistedDashboards(): void {
  if (typeof window === "undefined") return;
  try {
    const storedIndex = window.localStorage.getItem(DASHBOARD_INDEX_STORAGE_KEY);
    if (storedIndex) {
      const dashboardIds = JSON.parse(storedIndex) as string[];
      for (const id of dashboardIds) {
        window.localStorage.removeItem(makeDashboardStorageKey(id));
      }
    }
    window.localStorage.removeItem(DASHBOARD_INDEX_STORAGE_KEY);
  } catch {
    // Ignore localStorage read/write errors.
  }
}
