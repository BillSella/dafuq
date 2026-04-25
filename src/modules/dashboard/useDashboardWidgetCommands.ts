import { clamp } from "../../widgets/baseWidget";
import {
  deleteWidgetInDashboards,
  projectPlacementAcrossBreakpoints,
  updateWidgetConfigInDashboards,
  updateWidgetInDashboards,
  updateWidgetVisibilityInDashboards,
  type DashboardBreakpoint,
  type DashboardDoc,
  type DashboardWidgetDoc,
  type WidgetPatch
} from "../../dashboardStore";
import { BREAKPOINT_IDS } from "../../layoutService";
import type {
  CommonWidgetSettingsPatch,
  WidgetConfigMap,
  WidgetType
} from "../../widgets/widgetRegistry";
import { widgetRegistry } from "../../widgets/widgetRegistry";
import type { DashboardWidget } from "./dashboardEditorConstants";
import type { Accessor, Setter } from "solid-js";

type UseDashboardWidgetCommandsOptions = {
  dashboards: Accessor<DashboardDoc[]>;
  setDashboards: Setter<DashboardDoc[]>;
  activeDashboardId: Accessor<string>;
  selectedBreakpoint: Accessor<DashboardBreakpoint>;
  columns: Accessor<number>;
  rows: Accessor<number>;
  step: Accessor<number>;
  gridViewportWidth: Accessor<number>;
  gridViewportHeight: Accessor<number>;
  widgets: Accessor<DashboardWidget[]>;
  setWidgetMenuOpen: Setter<boolean>;
  setConfigWidgetId: Setter<string | null>;
  configWidgetId: Accessor<string | null>;
  updatePanelPlacement: () => void;
  bumpDebug: (eventName: string, payload?: unknown) => void;
  idCounterRef: { current: number };
};

export function useDashboardWidgetCommands(options: UseDashboardWidgetCommandsOptions) {
  const updateWidget = (id: string, patch: WidgetPatch) => {
    options.bumpDebug("updateWidget", { id, patch });
    const currentDashboardId = options.activeDashboardId();
    const currentBreakpoint = options.selectedBreakpoint();
    options.setDashboards((previous) =>
      updateWidgetInDashboards(previous, currentDashboardId, currentBreakpoint, id, patch)
    );
  };

  const updateWidgetConfig = (
    id: string,
    patch: Partial<WidgetConfigMap[WidgetType]> | CommonWidgetSettingsPatch
  ) => {
    options.bumpDebug("updateWidgetConfig", { id, patch });
    const currentDashboardId = options.activeDashboardId();
    const currentBreakpoint = options.selectedBreakpoint();
    options.setDashboards((previous) =>
      updateWidgetConfigInDashboards(previous, currentDashboardId, currentBreakpoint, id, patch)
    );
  };

  const updateWidgetVisibility = (id: string, breakpoint: DashboardBreakpoint, visible: boolean) => {
    const currentDashboardId = options.activeDashboardId();
    options.setDashboards((previous) =>
      updateWidgetVisibilityInDashboards(previous, currentDashboardId, id, breakpoint, visible)
    );
  };

  const deleteWidget = (id: string) => {
    options.bumpDebug("deleteWidget", { id });
    const currentDashboardId = options.activeDashboardId();
    options.setDashboards((previous) => deleteWidgetInDashboards(previous, currentDashboardId, id));
    if (options.configWidgetId() === id) options.setConfigWidgetId(null);
  };

  const getWidgetFootprintForCurrentGrid = (type: WidgetType): { colSpan: number; rowSpan: number } => {
    const base = widgetRegistry[type].createState("size-probe", 1, 1);
    const LEGACY_STEP = 16;
    const minSpan = Math.max(1, Math.ceil(16 / Math.max(1, options.step())));
    return {
      colSpan: clamp(
        Math.max(minSpan, Math.round((base.colSpan * LEGACY_STEP) / Math.max(1, options.step()))),
        minSpan,
        options.columns()
      ),
      rowSpan: clamp(
        Math.max(minSpan, Math.round((base.rowSpan * LEGACY_STEP) / Math.max(1, options.step()))),
        minSpan,
        options.rows()
      )
    };
  };

  const addWidgetAt = (type: WidgetType, col: number, row: number) => {
    const id = `widget-${options.idCounterRef.current++}-${crypto.randomUUID()}`;
    const baseState = widgetRegistry[type].createState(id, col, row);
    const footprint = getWidgetFootprintForCurrentGrid(type);
    const colStart = clamp(baseState.colStart, 1, options.columns() - footprint.colSpan + 1);
    const rowStart = clamp(baseState.rowStart, 1, options.rows() - footprint.rowSpan + 1);
    const currentBreakpoint = options.selectedBreakpoint();
    const nextState: DashboardWidget = {
      ...baseState,
      colStart,
      rowStart,
      colSpan: footprint.colSpan,
      rowSpan: footprint.rowSpan
    };
    const widgetDoc: DashboardWidgetDoc = {
      id: nextState.id,
      type: nextState.type,
      config: nextState.config,
      placements: projectPlacementAcrossBreakpoints(
        currentBreakpoint,
        {
          colStart: nextState.colStart,
          rowStart: nextState.rowStart,
          colSpan: nextState.colSpan,
          rowSpan: nextState.rowSpan
        },
        options.gridViewportWidth(),
        options.gridViewportHeight()
      ),
      display: BREAKPOINT_IDS.map((breakpoint) => ({
        breakpoint,
        ...widgetRegistry[nextState.type].getDisplayConfigFromConfig(nextState.config)
      }))
    };
    const currentDashboardId = options.activeDashboardId();
    options.setDashboards((previous) =>
      previous.map((dashboard) =>
        dashboard.id === currentDashboardId ? { ...dashboard, widgets: [...dashboard.widgets, widgetDoc] } : dashboard
      )
    );
    options.setConfigWidgetId(id);
    queueMicrotask(options.updatePanelPlacement);
  };

  const addWidgetFromMenu = (type: WidgetType) => {
    const count = options.widgets().length;
    const footprint = getWidgetFootprintForCurrentGrid(type);
    const gapUnits = 1;
    const laneWidth = Math.max(footprint.colSpan + gapUnits, Math.floor(options.columns() / 2));
    const col = 1 + (count % 2) * laneWidth;
    const row = 1 + Math.floor(count / 2) * (footprint.rowSpan + gapUnits);
    addWidgetAt(type, col, row);
    options.setWidgetMenuOpen(false);
  };

  return {
    updateWidget,
    updateWidgetConfig,
    updateWidgetVisibility,
    deleteWidget,
    getWidgetFootprintForCurrentGrid,
    addWidgetAt,
    addWidgetFromMenu
  };
}
