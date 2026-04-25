import type { Accessor, Setter } from "solid-js";
import { clamp } from "../../widgets/baseWidget";
import {
  createDashboardDoc,
  UPDATE_FREQUENCY_OPTIONS,
  type DashboardBreakpoint,
  type DashboardDoc
} from "../../dashboardStore";
import { BREAKPOINT_IDS, BREAKPOINT_OPTIONS } from "../../layoutService";

type UseDashboardManagementOptions = {
  dashboards: Accessor<DashboardDoc[]>;
  setDashboards: Setter<DashboardDoc[]>;
  activeDashboardId: Accessor<string>;
  setActiveDashboardId: Setter<string>;
  activeDashboardDoc: Accessor<DashboardDoc | null>;
  dashboardLocked: Accessor<boolean>;
  setDashboardLocked: Setter<boolean>;
  selectedBreakpoint: Accessor<DashboardBreakpoint>;
  setSelectedBreakpoint: Setter<DashboardBreakpoint>;
  setHasManualBreakpointSelection: Setter<boolean>;
  setDashboardMenuOpen: Setter<boolean>;
  setDashboardSettingsOpen: Setter<boolean>;
  setDashboardDeleteConfirmInput: Setter<string>;
  baseRows: Accessor<number>;
  dashboardSettingsOpen: Accessor<boolean>;
  dashboardSettingsWidth: Accessor<number>;
  dashboardSettingsHeight: Accessor<number>;
  gridRef: Accessor<HTMLDivElement | undefined>;
  setDashboardSettingsLeft: Setter<number>;
  setDashboardSettingsTop: Setter<number>;
};

/**
 * Dashboard CRUD and layout-management commands for topbar actions.
 */
export function useDashboardManagement(options: UseDashboardManagementOptions) {
  const updateDashboardSettingsPlacement = () => {
    if (!options.dashboardSettingsOpen()) return;
    const gridRef = options.gridRef();
    if (!gridRef) return;
    const panelWidth = options.dashboardSettingsWidth();
    const panelHeight = options.dashboardSettingsHeight();
    const margin = 12;
    const gridRect = gridRef.getBoundingClientRect();
    const centeredLeft = clamp(
      gridRect.left + gridRect.width / 2 - panelWidth / 2,
      margin,
      window.innerWidth - panelWidth - margin
    );
    const centeredTop = clamp(
      gridRect.top + gridRect.height / 2 - panelHeight / 2,
      margin,
      window.innerHeight - panelHeight - margin
    );
    options.setDashboardSettingsLeft(centeredLeft);
    options.setDashboardSettingsTop(centeredTop);
  };

  const createDashboard = () => {
    const existing = options.dashboards().map((dashboard) => dashboard.name);
    let nextIndex = existing.length + 1;
    let candidate = `Dashboard ${nextIndex}`;
    const existingSet = new Set(existing);
    while (existingSet.has(candidate)) {
      nextIndex += 1;
      candidate = `Dashboard ${nextIndex}`;
    }
    const nextDashboard = createDashboardDoc(candidate, false, BREAKPOINT_IDS);
    options.setDashboards((previous) => [...previous, nextDashboard]);
    options.setActiveDashboardId(nextDashboard.id);
    options.setSelectedBreakpoint("desktopFhd");
    options.setHasManualBreakpointSelection(true);
    options.setDashboardLocked(false);
    options.setDashboardMenuOpen(false);
    options.setDashboardSettingsOpen(true);
    queueMicrotask(updateDashboardSettingsPlacement);
  };

  const renameActiveDashboard = (nextName: string) => {
    const currentId = options.activeDashboardId();
    options.setDashboards((previous) =>
      previous.map((dashboard) => (dashboard.id === currentId ? { ...dashboard, name: nextName } : dashboard))
    );
  };

  const setDashboardBreakpointEnabled = (breakpoint: DashboardBreakpoint, enabled: boolean) => {
    if (options.dashboardLocked()) return;
    const currentDashboardId = options.activeDashboardId();
    if (!currentDashboardId) return;
    const active = options.activeDashboardDoc();
    if (!active) return;
    const currentlyEnabled = BREAKPOINT_OPTIONS.filter(
      (option) => active.enabledBreakpoints?.[option.id] ?? true
    );
    if (!enabled && currentlyEnabled.length <= 1 && currentlyEnabled[0]?.id === breakpoint) return;

    options.setDashboards((previous) =>
      previous.map((dashboard) =>
        dashboard.id === currentDashboardId
          ? {
              ...dashboard,
              enabledBreakpoints: { ...dashboard.enabledBreakpoints, [breakpoint]: enabled }
            }
          : dashboard
      )
    );

    if (!enabled && options.selectedBreakpoint() === breakpoint) {
      const fallback =
        (BREAKPOINT_OPTIONS.find(
          (option) =>
            option.id === "desktopFhd" &&
            option.id !== breakpoint &&
            (active.enabledBreakpoints?.[option.id] ?? true)
        )?.id ??
          BREAKPOINT_OPTIONS.find(
            (option) => option.id !== breakpoint && (active.enabledBreakpoints?.[option.id] ?? true)
          )?.id ??
          BREAKPOINT_OPTIONS[0].id) as DashboardBreakpoint;
      options.setSelectedBreakpoint(fallback);
      options.setHasManualBreakpointSelection(true);
    }
  };

  const updateActiveDashboardFrequencyByIndex = (nextIndex: number) => {
    const currentId = options.activeDashboardId();
    const clampedIndex = clamp(nextIndex, 0, UPDATE_FREQUENCY_OPTIONS.length - 1);
    const snapped = UPDATE_FREQUENCY_OPTIONS[clampedIndex] ?? UPDATE_FREQUENCY_OPTIONS[0];
    options.setDashboards((previous) =>
      previous.map((dashboard) =>
        dashboard.id === currentId ? { ...dashboard, updateFrequencySeconds: snapped } : dashboard
      )
    );
  };

  const deleteActiveDashboard = () => {
    const currentId = options.activeDashboardId();
    const remaining = options.dashboards().filter((dashboard) => dashboard.id !== currentId);
    if (remaining.length === 0) {
      const fallback = createDashboardDoc("Dashboard 1", false, BREAKPOINT_IDS);
      options.setDashboards([fallback]);
      options.setActiveDashboardId(fallback.id);
      options.setSelectedBreakpoint("desktopFhd");
      options.setHasManualBreakpointSelection(true);
    } else {
      options.setDashboards(remaining);
      options.setActiveDashboardId(remaining[0].id);
    }
    options.setDashboardLocked(true);
    options.setDashboardDeleteConfirmInput("");
    options.setDashboardSettingsOpen(false);
  };

  const addGridPage = () => {
    if (options.dashboardLocked()) return;
    const currentDashboardId = options.activeDashboardId();
    const currentBreakpoint = options.selectedBreakpoint();
    const pageRows = options.baseRows();
    options.setDashboards((previous) =>
      previous.map((dashboard) =>
        dashboard.id === currentDashboardId
          ? {
              ...dashboard,
              extraGridRows: {
                ...dashboard.extraGridRows,
                [currentBreakpoint]: (dashboard.extraGridRows?.[currentBreakpoint] ?? 0) + pageRows
              }
            }
          : dashboard
      )
    );
  };

  return {
    createDashboard,
    renameActiveDashboard,
    setDashboardBreakpointEnabled,
    updateActiveDashboardFrequencyByIndex,
    deleteActiveDashboard,
    addGridPage,
    updateDashboardSettingsPlacement
  };
}
