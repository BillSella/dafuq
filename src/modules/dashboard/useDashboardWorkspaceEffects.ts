import { createEffect, onCleanup, type Accessor, type Setter } from "solid-js";
import type { DashboardBreakpoint, DashboardDoc } from "./dashboardStore";
import { BREAKPOINT_IDS } from "./layoutService";
import { getWidgetPlacement } from "./dashboardStore";
import { widgetRegistry } from "../../widgets/widgetRegistry";

type UseDashboardWorkspaceEffectsOptions = {
  debugWidgetEvents: boolean;
  debugCounts: Accessor<Record<string, number>>;
  setDashboards: Setter<DashboardDoc[]>;
  selectedBreakpoint: Accessor<DashboardBreakpoint>;
  normalizedOnceRef: { current: boolean };
  setVisibilityMenuOpen: Setter<boolean>;
  configWidgetId: Accessor<string | null>;
  dashboardLocked: Accessor<boolean>;
  setConfigWidgetId: Setter<string | null>;
  setDragPreview: Setter<{
    type: import("../../widgets/widgetRegistry").WidgetType;
    colStart: number;
    rowStart: number;
    colSpan: number;
    rowSpan: number;
  } | null>;
  setDraggingLibraryType: Setter<import("../../widgets/widgetRegistry").WidgetType | null>;
  setBreakpointMenuOpen: Setter<boolean>;
  setWidgetMenuOpen: Setter<boolean>;
  setDashboardSettingsOpen: Setter<boolean>;
  closeRollbackMenu: () => void;
  setDashboardMenuOpen: Setter<boolean>;
  activeDashboardId: Accessor<string>;
  dashboards: Accessor<DashboardDoc[]>;
  setActiveDashboardId: Setter<string>;
  activeNavTool: Accessor<import("../moduleTypes").AppModuleId>;
  gridShellRef: Accessor<HTMLDivElement | undefined>;
  setGridViewportWidth: Setter<number>;
  setGridViewportHeight: Setter<number>;
  ensureWidgetsFitGrid: (nextColumns: number, nextRows: number) => void;
  columns: Accessor<number>;
  rows: Accessor<number>;
  activeDashboardDoc: Accessor<DashboardDoc | null>;
  baseRows: Accessor<number>;
  bottomOccupiedRow: Accessor<number>;
  previousStepRef: { current: number };
  step: Accessor<number>;
};

/**
 * Non-UI dashboard side effects: normalization, guards, resize observers, and grid syncing.
 */
export function useDashboardWorkspaceEffects(options: UseDashboardWorkspaceEffectsOptions) {
  createEffect(() => {
    if (!options.debugWidgetEvents) return;
    (window as any).__widgetDebug = options.debugCounts;
  });

  createEffect(() => {
    if (options.normalizedOnceRef.current) return;
    options.normalizedOnceRef.current = true;
    options.setDashboards((previous) =>
      previous.map((dashboard) => ({
        ...dashboard,
        enabledBreakpoints:
          Object.values(dashboard.enabledBreakpoints ?? {}).filter(Boolean).length <= 1
            ? (Object.fromEntries(BREAKPOINT_IDS.map((breakpoint) => [breakpoint, true])) as Record<
                DashboardBreakpoint,
                boolean
              >)
            : dashboard.enabledBreakpoints,
        widgets: dashboard.widgets.map((widget) => ({
          ...widget,
          config: widgetRegistry[widget.type].normalizeConfig({
            id: widget.id,
            type: widget.type,
            colStart: getWidgetPlacement(widget, options.selectedBreakpoint()).colStart,
            rowStart: getWidgetPlacement(widget, options.selectedBreakpoint()).rowStart,
            colSpan: getWidgetPlacement(widget, options.selectedBreakpoint()).colSpan,
            rowSpan: getWidgetPlacement(widget, options.selectedBreakpoint()).rowSpan,
            config: widget.config
          })
        }))
      }))
    );
  });

  createEffect(() => {
    if (options.configWidgetId()) return;
    options.setVisibilityMenuOpen(false);
  });

  createEffect(() => {
    if (!options.dashboardLocked()) return;
    options.setConfigWidgetId(null);
    options.setDragPreview(null);
    options.setDraggingLibraryType(null);
    options.setBreakpointMenuOpen(false);
    options.setWidgetMenuOpen(false);
    options.setDashboardSettingsOpen(false);
    options.closeRollbackMenu();
  });

  createEffect(() => {
    if (options.dashboardLocked()) return;
    options.setDashboardMenuOpen(false);
  });

  createEffect(() => {
    const docs = options.dashboards();
    if (docs.length === 0) return;
    const activeId = options.activeDashboardId();
    if (!docs.some((doc) => doc.id === activeId)) {
      options.setActiveDashboardId(docs[0].id);
    }
  });

  createEffect(() => {
    if (options.activeNavTool() !== "dashboards") return;
    const gridShell = options.gridShellRef();
    if (!gridShell) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      options.setGridViewportWidth(entry.contentRect.width);
      options.setGridViewportHeight(entry.contentRect.height);
    });
    observer.observe(gridShell);
    onCleanup(() => observer.disconnect());
  });

  createEffect(() => {
    if (options.activeNavTool() !== "dashboards") return;
    options.ensureWidgetsFitGrid(options.columns(), options.rows());
  });

  createEffect(() => {
    if (!options.dashboardLocked()) return;
    const active = options.activeDashboardDoc();
    if (!active) return;
    const currentDashboardId = options.activeDashboardId();
    const currentBreakpoint = options.selectedBreakpoint();
    const targetExtraRows = Math.max(0, options.bottomOccupiedRow() - options.baseRows());
    const currentExtraRows = active.extraGridRows?.[currentBreakpoint] ?? 0;
    if (currentExtraRows === targetExtraRows) return;
    options.setDashboards((previous) =>
      previous.map((dashboard) =>
        dashboard.id === currentDashboardId
          ? {
              ...dashboard,
              extraGridRows: {
                ...dashboard.extraGridRows,
                [currentBreakpoint]: targetExtraRows
              }
            }
          : dashboard
      )
    );
  });

  createEffect(() => {
    const currentStep = options.step();
    if (currentStep === options.previousStepRef.current) return;
    options.previousStepRef.current = currentStep;
  });
}
