import { createEffect, onCleanup, type Accessor } from "solid-js";
import type { DashboardDoc } from "./dashboardStore";

type UseDashboardAutosaveOptions = {
  dashboards: Accessor<DashboardDoc[]>;
  serverSyncReady: Accessor<boolean>;
  isAuthenticated: Accessor<boolean>;
  persistToStorage: (docs: DashboardDoc[]) => void;
  saveToServer: (docs: DashboardDoc[]) => Promise<unknown> | unknown;
  delayMs?: number;
};

/**
 * Debounces dashboard persistence to local storage and server.
 *
 * State modification contract:
 * - Source of truth: caller-owned dashboard docs accessor.
 * - Mutation path: no direct state ownership; side effects are delegated through
 *   `persistToStorage` and `saveToServer`.
 * - Guard behavior: server saves are skipped until sync is ready and user is authenticated.
 */
export function useDashboardAutosave(options: UseDashboardAutosaveOptions) {
  const delayMs = options.delayMs ?? 1200;
  let dashboardServerSaveTimer: number | undefined;

  createEffect(() => {
    const docs = options.dashboards();
    options.persistToStorage(docs);
    if (!options.serverSyncReady()) {
      return;
    }
    if (!options.isAuthenticated()) {
      if (dashboardServerSaveTimer !== undefined) {
        window.clearTimeout(dashboardServerSaveTimer);
        dashboardServerSaveTimer = undefined;
      }
      return;
    }
    if (dashboardServerSaveTimer !== undefined) {
      window.clearTimeout(dashboardServerSaveTimer);
    }
    dashboardServerSaveTimer = window.setTimeout(() => {
      dashboardServerSaveTimer = undefined;
      void options.saveToServer(docs);
    }, delayMs);
  });

  onCleanup(() => {
    if (dashboardServerSaveTimer !== undefined) {
      window.clearTimeout(dashboardServerSaveTimer);
    }
  });
}
