import {
  DASHBOARD_INDEX_STORAGE_KEY,
  createDashboardDoc,
  makeDashboardStorageKey,
  normalizeDashboardDoc,
  type DashboardBreakpoint,
  type DashboardDoc
} from "./dashboardStore";

export function createDefaultDashboards(breakpointIds: DashboardBreakpoint[]): DashboardDoc[] {
  void breakpointIds;
  return [];
}

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
