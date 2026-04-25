import { createEffect, createSignal, onMount, type Accessor, type Setter } from "solid-js";
import type { DashboardBreakpoint, DashboardDoc } from "../dashboardStore";
import { persistDashboardsToStorage } from "../dashboardPersistence";
import { fetchDashboardsFromServer } from "../dashboardServerSync";
import { getAccessToken } from "../authToken";
import { useSession } from "../session/SessionContext";

/**
 * After boot: optionally load dashboards from the API, then mark sync ready.
 * On every dashboard list change: persist to localStorage.
 * Must be called from a component under {@link SessionProvider}.
 */
export function useDashboardServerSync(options: {
  breakpointIds: DashboardBreakpoint[];
  dashboards: Accessor<DashboardDoc[]>;
  setDashboards: Setter<DashboardDoc[]>;
  setActiveDashboardId: Setter<string>;
}): void {
  const session = useSession();
  const [serverSyncReady, setServerSyncReady] = createSignal(false);

  createEffect(() => {
    persistDashboardsToStorage(options.dashboards());
  });

  onMount(() => {
    void (async () => {
      try {
        if (getAccessToken()) {
          const remote = await fetchDashboardsFromServer(options.breakpointIds);
          if (remote) {
            options.setDashboards(remote);
            options.setActiveDashboardId(remote[0]?.id ?? "");
          }
        }
      } finally {
        setServerSyncReady(true);
        session.syncFromStorage();
      }
    })();
  });
}
