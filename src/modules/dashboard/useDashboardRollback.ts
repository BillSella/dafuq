import { createSignal, type Accessor, type Setter } from "solid-js";
import type { DashboardBreakpoint, DashboardDoc } from "./dashboardStore";
import {
  fetchDashboardVersionsFromServer,
  rollbackDashboardToVersion
} from "./dashboardServerSync";

type UseDashboardRollbackOptions = {
  activeDashboardId: Accessor<string>;
  setDashboards: Setter<DashboardDoc[]>;
  breakpointIds: DashboardBreakpoint[];
};

/**
 * Encapsulates rollback menu state and rollback execution commands.
 *
 * State modification contract:
 * - Source of truth: local rollback UI signals (`rollbackMenuOpen`, `rollbackBusy`,
 *   `rollbackVersions`) plus caller-owned dashboard docs via `setDashboards`.
 * - Mutation paths:
 *   - `openRollbackMenu` fetches available versions and toggles menu state.
 *   - `rollbackToVersion` confirms intent, executes rollback, and updates caller dashboards.
 *   - `closeRollbackMenu` closes menu without side effects.
 * - Guard behavior:
 *   - missing active dashboard id short-circuits remote calls
 *   - failed rollbacks surface alert and preserve current dashboards
 */
export function useDashboardRollback(options: UseDashboardRollbackOptions) {
  const [rollbackMenuOpen, setRollbackMenuOpen] = createSignal(false);
  const [rollbackBusy, setRollbackBusy] = createSignal(false);
  const [rollbackVersions, setRollbackVersions] = createSignal<string[]>([]);

  /**
   * Closes rollback version menu.
   */
  const closeRollbackMenu = () => {
    setRollbackMenuOpen(false);
  };

  /**
   * Opens rollback menu and loads version list for the active dashboard.
   */
  const openRollbackMenu = async () => {
    if (rollbackMenuOpen()) {
      setRollbackMenuOpen(false);
      return;
    }
    const dashboardId = options.activeDashboardId();
    if (!dashboardId) {
      setRollbackVersions([]);
      setRollbackMenuOpen(true);
      return;
    }
    setRollbackBusy(true);
    try {
      const versions = await fetchDashboardVersionsFromServer(dashboardId);
      setRollbackVersions(versions ?? []);
      setRollbackMenuOpen(true);
    } finally {
      setRollbackBusy(false);
    }
  };

  /**
   * Requests rollback to selected timestamp and replaces the active dashboard on success.
   */
  const rollbackToVersion = async (timestamp: string) => {
    const dashboardId = options.activeDashboardId();
    if (!dashboardId) return;
    const shouldRollback = window.confirm(
      `Rollback dashboard to ${timestamp}? Unsaved local edits will be replaced.`
    );
    if (!shouldRollback) return;
    setRollbackBusy(true);
    try {
      const rolledBack = await rollbackDashboardToVersion(
        dashboardId,
        timestamp,
        options.breakpointIds
      );
      if (!rolledBack) {
        window.alert("Rollback failed. Please try again.");
        return;
      }
      options.setDashboards((previous) =>
        previous.map((dashboard) => (dashboard.id === dashboardId ? rolledBack : dashboard))
      );
      setRollbackMenuOpen(false);
    } finally {
      setRollbackBusy(false);
    }
  };

  return {
    rollbackMenuOpen,
    rollbackBusy,
    rollbackVersions,
    openRollbackMenu,
    rollbackToVersion,
    closeRollbackMenu
  };
}
