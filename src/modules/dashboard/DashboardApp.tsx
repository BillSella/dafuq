import { For, Show, createEffect, createMemo, createSignal, onCleanup, onMount, type JSX } from "solid-js";
import { type GaugeConfig } from "../../widgets/gaugeWidget";
import { type LabelConfig } from "../../widgets/labelWidget";
import { DonutWidget, type DonutConfig } from "../../widgets/donutWidget";
import { BarWidget, type BarConfig } from "../../widgets/barWidget";
import { SparklineWidget, type SparklineConfig } from "../../widgets/sparklineWidget";
import { TimeSeriesWidget, type TimeSeriesConfig } from "../../widgets/timeSeriesWidget";
import { MapWidget, type MapConfig } from "../../widgets/mapWidget";
import { MAP_VIEW_H, MAP_VIEW_W } from "../../widgets/mapProjections";
import { clamp } from "../../widgets/baseWidget";
import {
  UPDATE_FREQUENCY_OPTIONS,
  type DashboardBreakpoint,
  type DashboardDoc,
  getWidgetDisplayConfig,
  getWidgetPlacement,
  upsertWidgetPlacement,
  type WidgetDisplayConfig,
  ensureWidgetsFitGridInDashboards,
} from "./dashboardStore";
import {
  loadDashboardsFromStorage,
  persistDashboardsToStorage
} from "./dashboardPersistence";
import {
  BREAKPOINT_IDS,
  BREAKPOINT_OPTIONS,
  getGridSizeForBreakpoint
} from "./layoutService";
import {
  DEFAULT_WIDGET_TYPE,
  type WidgetType,
  widgetLibrary,
  widgetRegistry,
  type WidgetStateByType
} from "../../widgets/widgetRegistry";
import { BaseWidgetSettingsSection } from "../../components/config/BaseWidgetSettingsSection";
import { DashboardSettingsOverlay } from "../../components/config/DashboardSettingsOverlay";
import { AppTopbarCenter } from "../../components/layout/AppTopbarCenter";
import { AppTopbarTools } from "../../components/layout/AppTopbarTools";
import { ToolButton } from "../../components/ui/ToolButton";
import {
  RELATIVE_PRESETS,
  timeWindowButtonLabel,
  timeWindowSummaryLabel
} from "./timeWindow";
import { useSession } from "../../session/SessionContext";
import { fetchDashboardsFromServer, saveDashboardsToServer } from "./dashboardServerSync";
import { useDashboardRollback } from "./useDashboardRollback";
import { useDashboardAutosave } from "./useDashboardAutosave";
import {
  DEBUG_WIDGET_EVENTS,
  LIBRARY_WIDGET_KEY,
  type DashboardWidget,
  type SlideDirection,
  WIDGET_SETTINGS_COLUMN_GAP,
  WIDGET_SETTINGS_DIVIDER_WIDTH,
  WIDGET_SETTINGS_LEFT_COLUMN_WIDTH,
  WIDGET_SETTINGS_PANEL_CHROME,
  WIDGET_SETTINGS_RIGHT_COLUMN_WIDTH,
  widgetTypeIcon
} from "./dashboardEditorConstants";
import { DashboardMainRegion } from "./DashboardMainRegion";
import { DashboardEditorGrid } from "./DashboardEditorGrid";
import { DashboardWidgetCard } from "./DashboardWidgetCard";
import { DashboardWidgetConfigOverlay } from "./DashboardWidgetConfigOverlay";
import { useDashboardBreakpointEffects } from "./useDashboardBreakpointEffects";
import { useDashboardDismissals } from "./useDashboardDismissals";
import { useDashboardInteractions } from "./useDashboardInteractions";
import { useDashboardManagement } from "./useDashboardManagement";
import { useDashboardRuntimeValues } from "./useDashboardRuntimeValues";
import { useDashboardTopbarTimeWindow } from "./useDashboardTopbarTimeWindow";
import { useDashboardWidgetCommands } from "./useDashboardWidgetCommands";
import { useDashboardWorkspaceEffects } from "./useDashboardWorkspaceEffects";
import { getAppModule } from "../moduleRegistry";
import type { AppModuleId } from "../moduleTypes";
import type { WorkspaceShellProps } from "../shell/WorkspaceShell";

type DashboardAppProps = {
  /**
   * App-level active module id owned by WorkspaceApp.
   */
  activeNavTool: AppModuleId;
  /**
   * App-level module selection callback owned by WorkspaceApp.
   */
  onSelectNavTool: (moduleId: AppModuleId) => void;
  /**
   * App-level module access gate for non-dashboard module hosting.
   */
  canAccessModule: (moduleId: AppModuleId) => boolean;
  /**
   * App-level shell renderer.
   */
  renderShell: (props: WorkspaceShellProps) => JSX.Element;
};

/**
 * Authenticated workspace: dashboard state and topbar wiring, hosted inside
 * {@link WorkspaceShell}. Re-exported as default from `App.tsx`.
 */
export default function DashboardApp(props: DashboardAppProps) {
  const session = useSession();
  const initialDashboards = loadDashboardsFromStorage(BREAKPOINT_IDS);
  const [gridUnitSize, setGridUnitSize] = createSignal(16);
  const [gridViewportWidth, setGridViewportWidth] = createSignal(900);
  const [gridViewportHeight, setGridViewportHeight] = createSignal(560);
  const [dashboards, setDashboards] = createSignal<DashboardDoc[]>(initialDashboards);
  const [activeDashboardId, setActiveDashboardId] = createSignal(initialDashboards[0]?.id ?? "");
  const [interaction, setInteraction] = createSignal<{ id: string; mode: "dragging" | "resizing" } | null>(null);
  const [configWidgetId, setConfigWidgetId] = createSignal<string | null>(null);
  const [slideDirection, setSlideDirection] = createSignal<SlideDirection>("right");
  const [panelTop, setPanelTop] = createSignal(0);
  const [panelLeft, setPanelLeft] = createSignal(0);
  const [widgetPanelWidth, setWidgetPanelWidth] = createSignal(460);
  const [widgetPanelHeight, setWidgetPanelHeight] = createSignal(520);
  const [dragPreview, setDragPreview] = createSignal<{
    type: WidgetType;
    colStart: number;
    rowStart: number;
    colSpan: number;
    rowSpan: number;
  } | null>(null);
  const [draggingLibraryType, setDraggingLibraryType] = createSignal<WidgetType | null>(null);
  const [debugCounts, setDebugCounts] = createSignal<Record<string, number>>({});
  const activeNavTool = () => props.activeNavTool;
  const [userMenuOpen, setUserMenuOpen] = createSignal(false);
  const topbarTime = useDashboardTopbarTimeWindow();
  const {
    timeWindow,
    timeWindowMenuOpen,
    timeWindowMenuView,
    customRangeFrom,
    customRangeTo,
    currentClock,
    currentClockIso,
    topbarCustomTimeSpan,
    setTimeWindowMenuOpen,
    setTimeWindowMenuView,
    setCustomRangeFrom,
    setCustomRangeTo,
    applyTimeWindow,
    openTimeWindowCustom,
    applyTimeWindowCustom
  } = topbarTime;
  const [serverSyncReady, setServerSyncReady] = createSignal(false);
  const [dashboardMenuOpen, setDashboardMenuOpen] = createSignal(false);
  const [dashboardLocked, setDashboardLocked] = createSignal(true);
  const [selectedBreakpoint, setSelectedBreakpoint] = createSignal<DashboardBreakpoint>("desktopFhd");
  const [hasManualBreakpointSelection, setHasManualBreakpointSelection] = createSignal(false);
  const [breakpointMenuOpen, setBreakpointMenuOpen] = createSignal(false);
  const [widgetMenuOpen, setWidgetMenuOpen] = createSignal(false);
  const [visibilityMenuOpen, setVisibilityMenuOpen] = createSignal(false);
  const [dashboardSettingsOpen, setDashboardSettingsOpen] = createSignal(false);
  const [dashboardSettingsTop, setDashboardSettingsTop] = createSignal(0);
  const [dashboardSettingsLeft, setDashboardSettingsLeft] = createSignal(0);
  const [dashboardSettingsWidth] = createSignal(520);
  const [dashboardSettingsHeight] = createSignal(280);
  const [dashboardDeleteConfirmInput, setDashboardDeleteConfirmInput] = createSignal("");

  let gridRef: HTMLDivElement | undefined;
  let gridShellRef: HTMLDivElement | undefined;
  let widgetConfigPanelRef: HTMLDivElement | undefined;
  let userMenuRef: HTMLDivElement | undefined;
  let userMenuButtonRef: HTMLButtonElement | undefined;
  let timeWindowMenuRef: HTMLDivElement | undefined;
  let timeWindowButtonRef: HTMLButtonElement | undefined;
  let dashboardMenuRef: HTMLDivElement | undefined;
  let dashboardMenuButtonRef: HTMLButtonElement | undefined;
  let breakpointMenuRef: HTMLDivElement | undefined;
  let breakpointMenuButtonRef: HTMLButtonElement | undefined;
  let widgetMenuRef: HTMLDivElement | undefined;
  let widgetMenuButtonRef: HTMLButtonElement | undefined;
  let visibilityMenuRef: HTMLDivElement | undefined;
  let visibilityMenuButtonRef: HTMLButtonElement | undefined;
  let dashboardSettingsPanelRef: HTMLDivElement | undefined;
  let dashboardSettingsButtonRef: HTMLButtonElement | undefined;
  let rollbackMenuRef: HTMLDivElement | undefined;
  let rollbackButtonRef: HTMLButtonElement | undefined;
  const widgetRefs = new Map<string, HTMLDivElement>();
  const idCounterRef = { current: 2 };
  const previousStepRef = { current: 32 };
  const normalizedOnceRef = { current: false };
  const panelHeightMin = 360;
  const gap = 6;
  const edgePadding = gap / 2;
  const widgetInset = 1;
  const cellSize = createMemo(() => Math.max(1, gridUnitSize() - gap));

  const step = () => gridUnitSize();
  const rollback = useDashboardRollback({
    activeDashboardId,
    setDashboards,
    breakpointIds: BREAKPOINT_IDS
  });
  const activeDashboardDoc = createMemo(
    () => dashboards().find((dashboard) => dashboard.id === activeDashboardId()) ?? null
  );
  const selectedGridSpec = createMemo(() =>
    getGridSizeForBreakpoint(selectedBreakpoint(), gridViewportWidth(), gridViewportHeight())
  );
  const baseRows = createMemo(() => selectedGridSpec().rows);
  const dashboardManagement = useDashboardManagement({
    dashboards,
    setDashboards,
    activeDashboardId,
    setActiveDashboardId,
    activeDashboardDoc,
    dashboardLocked,
    setDashboardLocked,
    selectedBreakpoint,
    setSelectedBreakpoint,
    setHasManualBreakpointSelection,
    setDashboardMenuOpen,
    setDashboardSettingsOpen,
    setDashboardDeleteConfirmInput,
    baseRows,
    dashboardSettingsOpen,
    dashboardSettingsWidth,
    dashboardSettingsHeight,
    gridRef: () => gridRef,
    setDashboardSettingsLeft,
    setDashboardSettingsTop
  });
  const {
    createDashboard,
    renameActiveDashboard,
    setDashboardBreakpointEnabled,
    updateActiveDashboardFrequencyByIndex,
    deleteActiveDashboard,
    addGridPage,
    updateDashboardSettingsPlacement
  } = dashboardManagement;
  const runtime = useDashboardRuntimeValues({
    activeNavTool,
    activeDashboardDoc,
    timeWindow
  });
  const { runtimeWidgetValues, runtimeWidgetStatus } = runtime;
  const extraRowsForSelectedBreakpoint = createMemo(() => {
    const active = activeDashboardDoc();
    if (!active) return 0;
    return Math.max(0, active.extraGridRows?.[selectedBreakpoint()] ?? 0);
  });
  const bottomOccupiedRow = createMemo(() => {
    const active = activeDashboardDoc();
    if (!active) return baseRows();
    let bottom = 1;
    for (const widget of active.widgets) {
      const placement = getWidgetPlacement(widget, selectedBreakpoint());
      if (placement.visible === false) continue;
      bottom = Math.max(bottom, placement.rowStart + placement.rowSpan - 1);
    }
    return Math.max(1, bottom);
  });
  const columns = createMemo(() => selectedGridSpec().columns);
  const rows = createMemo(() =>
    dashboardLocked()
      ? Math.max(baseRows(), bottomOccupiedRow())
      : Math.max(baseRows(), baseRows() + extraRowsForSelectedBreakpoint())
  );
  const gridWidth = () => columns() * step();
  const gridHeight = () => rows() * step();
  const showGrid = createMemo(() => !dashboardLocked());
  const activeDashboardName = createMemo(() => activeDashboardDoc()?.name ?? "Dashboard");
  const widgets = createMemo<DashboardWidget[]>(() => {
    const active = activeDashboardDoc();
    if (!active) return [];
    return active.widgets
      .map((widget) => {
        const placement = getWidgetPlacement(widget, selectedBreakpoint());
        if (!placement.visible) return null;
        const display = getWidgetDisplayConfig(widget, selectedBreakpoint());
        return {
          id: widget.id,
          type: widget.type,
          colStart: placement.colStart,
          rowStart: placement.rowStart,
          colSpan: placement.colSpan,
          rowSpan: placement.rowSpan,
          config: {
            ...widget.config,
            ...display
          }
        };
      })
      .filter((widget): widget is DashboardWidget => !!widget);
  });
  const activeWidgetDoc = createMemo(
    () => activeDashboardDoc()?.widgets.find((widget) => widget.id === configWidgetId()) ?? null
  );
  const activeWidget = createMemo(() =>
    widgets().find((widget) => widget.id === configWidgetId()) ?? undefined
  );
  const activeGaugeWidget = createMemo(() =>
    activeWidget()?.type === "numberGauge"
      ? (activeWidget() as WidgetStateByType<"numberGauge">)
      : undefined
  );
  const activeLabelWidget = createMemo(() =>
    activeWidget()?.type === "label"
      ? (activeWidget() as WidgetStateByType<"label">)
      : undefined
  );
  const activeDonutWidget = createMemo(() =>
    activeWidget()?.type === "donutChart"
      ? (activeWidget() as WidgetStateByType<"donutChart">)
      : undefined
  );
  const activeBarWidget = createMemo(() =>
    activeWidget()?.type === "barChart"
      ? (activeWidget() as WidgetStateByType<"barChart">)
      : undefined
  );
  const activeSparklineWidget = createMemo(() =>
    activeWidget()?.type === "sparklineChart"
      ? (activeWidget() as WidgetStateByType<"sparklineChart">)
      : undefined
  );
  const activeTimeSeriesWidget = createMemo(() =>
    activeWidget()?.type === "timeSeriesChart"
      ? (activeWidget() as WidgetStateByType<"timeSeriesChart">)
      : undefined
  );
  const activeMapWidget = createMemo(() =>
    activeWidget()?.type === "mapNetwork"
      ? (activeWidget() as WidgetStateByType<"mapNetwork">)
      : undefined
  );
  const activeWidgetCommonLabel = createMemo(() => {
    const widget = activeWidget();
    if (!widget) return "";
    const cfg = widget.config;
    if ("staticText" in cfg) return cfg.staticText ?? "";
    if ("label" in cfg) return cfg.label ?? "";
    return "";
  });
  const activeWidgetCommonAlign = createMemo<"left" | "center" | "right">(() => {
    const widget = activeWidget();
    if (!widget) return "center";
    return widget.config.align ?? "center";
  });
  const activeWidgetCommonFontSize = createMemo<"small" | "medium" | "large">(() => {
    const widget = activeWidget();
    if (!widget) return "medium";
    return "fontSize" in widget.config && widget.config.fontSize
      ? widget.config.fontSize
      : "medium";
  });
  const getWidgetDisplayValue = (widget: DashboardWidget): string =>
    widgetRegistry[widget.type].getDisplayValueWithRuntime(
      widget,
      runtimeWidgetValues()[widget.id]
    );
  const dashboardUpdateGroups = createMemo(() => {
    const active = activeDashboardDoc();
    if (!active) return [] as string[];
    return Array.from(
      new Set(
        active.widgets
          .map((widget) => widget.config.updateGroup?.trim() ?? "")
          .filter((group) => group.length > 0)
      )
    ).sort((left, right) => left.localeCompare(right));
  });
  const selectedBreakpointLabel = createMemo(
    () =>
      BREAKPOINT_OPTIONS.find((option) => option.id === selectedBreakpoint())?.label ??
      "Desktop"
  );
  const isBreakpointEnabledForActiveDashboard = (breakpoint: DashboardBreakpoint): boolean => {
    const dashboard = activeDashboardDoc();
    return dashboard?.enabledBreakpoints?.[breakpoint] ?? true;
  };
  const enabledBreakpointOptions = createMemo(() =>
    BREAKPOINT_OPTIONS.filter((option) => isBreakpointEnabledForActiveDashboard(option.id))
  );
  const preferredEnabledBreakpoint = createMemo<DashboardBreakpoint | null>(() => {
    const enabled = enabledBreakpointOptions().map((option) => option.id);
    if (enabled.includes("desktopFhd")) return "desktopFhd";
    return enabled[0] ?? null;
  });
  const activeToolTitle = createMemo(() => getAppModule(activeNavTool()).topbarTitle);
  const selectNavTool = (moduleId: AppModuleId) => {
    props.onSelectNavTool(moduleId);
  };
  const fontSizeValue = (size: GaugeConfig["fontSize"]) => {
    if (size === "small") return "0.82rem";
    if (size === "large") return "1.2rem";
    return "1rem";
  };
  const textAlignValue = (align: GaugeConfig["align"]) => align;
  const renderBaseWidgetSettings = (labelField: "label" | "staticText") => (
    <BaseWidgetSettingsSection
      widgetDoc={activeWidgetDoc() ?? null}
      breakpointOptions={BREAKPOINT_OPTIONS}
      visibilityOpen={visibilityMenuOpen()}
      visibilityMenuRef={(el) => {
        visibilityMenuRef = el;
      }}
      visibilityButtonRef={(el) => {
        visibilityMenuButtonRef = el;
      }}
      onToggleVisibilityOpen={() => setVisibilityMenuOpen((open) => !open)}
      onVisibilityChange={(breakpoint, visible) => {
        const id = configWidgetId();
        if (!id) return;
        updateWidgetVisibility(id, breakpoint, visible);
      }}
      label={activeWidgetCommonLabel()}
      onLabelChange={(value) => {
        const id = configWidgetId();
        if (!id) return;
        if (labelField === "staticText") {
          updateWidgetConfig(id, { staticText: value });
          return;
        }
        updateWidgetConfig(id, { label: value });
      }}
      align={activeWidgetCommonAlign()}
      onAlignChange={(value) => {
        const id = configWidgetId();
        if (!id) return;
        updateWidgetConfig(id, { align: value });
      }}
      fontSize={activeWidgetCommonFontSize()}
      onFontSizeChange={(value) => {
        const id = configWidgetId();
        if (!id) return;
        updateWidgetConfig(id, { fontSize: value });
      }}
    />
  );
  const bumpDebug = (eventName: string, payload?: unknown) => {
    if (!DEBUG_WIDGET_EVENTS) return;
    setDebugCounts((prev) => ({ ...prev, [eventName]: (prev[eventName] ?? 0) + 1 }));
    if (payload !== undefined) {
      console.debug(`[widget-debug] ${eventName}`, payload);
      return;
    }
    console.debug(`[widget-debug] ${eventName}`);
  };

  const ensureWidgetsFitGrid = (nextColumns: number, nextRows: number) => {
    const minSpan = Math.max(1, Math.ceil(16 / step()));
    const currentDashboardId = activeDashboardId();
    const currentBreakpoint = selectedBreakpoint();
    setDashboards((previous) =>
      ensureWidgetsFitGridInDashboards(
        previous,
        currentDashboardId,
        currentBreakpoint,
        nextColumns,
        nextRows,
        minSpan
      )
    );
  };

  const updatePanelPlacement = () => {
    if (!configWidgetId()) return;
    if (!gridRef) return;
    const desiredWidth =
      WIDGET_SETTINGS_LEFT_COLUMN_WIDTH +
      WIDGET_SETTINGS_RIGHT_COLUMN_WIDTH +
      WIDGET_SETTINGS_DIVIDER_WIDTH +
      WIDGET_SETTINGS_COLUMN_GAP * 2 +
      WIDGET_SETTINGS_PANEL_CHROME;
    const nextWidth = clamp(desiredWidth, 340, window.innerWidth - 24);
    const contentHeight = widgetConfigPanelRef?.scrollHeight ?? widgetPanelHeight();
    const nextHeight = clamp(contentHeight, panelHeightMin, window.innerHeight - 24);
    setWidgetPanelWidth(nextWidth);
    setWidgetPanelHeight(nextHeight);
    // Widget settings panel is centered over grid by product decision.
    const gridRect = gridRef.getBoundingClientRect();
    const margin = 12;
    const topbarEl = document.querySelector(".app-topbar");
    const topbarBottom = topbarEl ? topbarEl.getBoundingClientRect().bottom : 0;
    const centeredLeft = clamp(
      gridRect.left + gridRect.width / 2 - nextWidth / 2,
      margin,
      window.innerWidth - nextWidth - margin
    );
    const availableTop = Math.max(margin, topbarBottom + margin);
    const availableBottom = window.innerHeight - margin;
    const availableHeight = Math.max(0, availableBottom - availableTop);
    const centeredTop = clamp(
      availableTop + availableHeight / 2 - nextHeight / 2,
      availableTop,
      availableBottom - nextHeight
    );
    setSlideDirection("bottom");
    setPanelLeft(centeredLeft);
    setPanelTop(centeredTop);
  };
  const widgetCommands = useDashboardWidgetCommands({
    dashboards,
    setDashboards,
    activeDashboardId,
    selectedBreakpoint,
    columns,
    rows,
    step,
    gridViewportWidth,
    gridViewportHeight,
    widgets,
    setWidgetMenuOpen,
    setConfigWidgetId,
    configWidgetId,
    updatePanelPlacement,
    bumpDebug,
    idCounterRef
  });
  const {
    updateWidget,
    updateWidgetConfig,
    updateWidgetVisibility,
    deleteWidget,
    getWidgetFootprintForCurrentGrid,
    addWidgetAt,
    addWidgetFromMenu
  } = widgetCommands;

  const interactions = useDashboardInteractions({
    dashboardLocked,
    bumpDebug,
    draggingLibraryType,
    setDraggingLibraryType,
    setDragPreview,
    dragPreview,
    getWidgetFootprintForCurrentGrid,
    addWidgetAt,
    columns,
    rows,
    step,
    gridRef: () => gridRef,
    configWidgetId,
    setConfigWidgetId,
    interaction,
    setInteraction,
    updateWidget,
    updatePanelPlacement,
    libraryWidgetKey: LIBRARY_WIDGET_KEY
  });
  const {
    onLibraryDragStart,
    handleGridDrop,
    handleGridDragOver,
    startWidgetDrag,
    startWidgetResize
  } = interactions;
  useDashboardDismissals({
    userMenuOpen,
    setUserMenuOpen,
    userMenuRef: () => userMenuRef,
    userMenuButtonRef: () => userMenuButtonRef,
    timeWindowMenuOpen,
    setTimeWindowMenuOpen,
    setTimeWindowMenuView,
    timeWindowMenuRef: () => timeWindowMenuRef,
    timeWindowButtonRef: () => timeWindowButtonRef,
    dashboardMenuOpen,
    setDashboardMenuOpen,
    dashboardMenuRef: () => dashboardMenuRef,
    dashboardMenuButtonRef: () => dashboardMenuButtonRef,
    widgetMenuOpen,
    setWidgetMenuOpen,
    widgetMenuRef: () => widgetMenuRef,
    widgetMenuButtonRef: () => widgetMenuButtonRef,
    visibilityMenuOpen,
    setVisibilityMenuOpen,
    visibilityMenuRef: () => visibilityMenuRef,
    visibilityMenuButtonRef: () => visibilityMenuButtonRef,
    breakpointMenuOpen,
    setBreakpointMenuOpen,
    breakpointMenuRef: () => breakpointMenuRef,
    breakpointMenuButtonRef: () => breakpointMenuButtonRef,
    rollbackMenuOpen: rollback.rollbackMenuOpen,
    closeRollbackMenu: rollback.closeRollbackMenu,
    rollbackMenuRef: () => rollbackMenuRef,
    rollbackButtonRef: () => rollbackButtonRef,
    dashboardSettingsOpen,
    setDashboardSettingsOpen,
    dashboardSettingsPanelRef: () => dashboardSettingsPanelRef,
    dashboardSettingsButtonRef: () => dashboardSettingsButtonRef,
    updateDashboardSettingsPlacement,
    activeDashboardName,
    setDashboardDeleteConfirmInput
  });
  useDashboardBreakpointEffects({
    hasManualBreakpointSelection,
    gridViewportWidth,
    gridViewportHeight,
    isBreakpointEnabledForActiveDashboard,
    preferredEnabledBreakpoint,
    selectedBreakpoint,
    setSelectedBreakpoint,
    selectedGridStep: () => selectedGridSpec().step,
    setGridUnitSize
  });

  useDashboardWorkspaceEffects({
    debugWidgetEvents: DEBUG_WIDGET_EVENTS,
    debugCounts,
    setDashboards,
    selectedBreakpoint,
    normalizedOnceRef,
    setVisibilityMenuOpen,
    configWidgetId,
    dashboardLocked,
    setConfigWidgetId,
    setDragPreview,
    setDraggingLibraryType,
    setBreakpointMenuOpen,
    setWidgetMenuOpen,
    setDashboardSettingsOpen,
    closeRollbackMenu: rollback.closeRollbackMenu,
    setDashboardMenuOpen,
    activeDashboardId,
    dashboards,
    setActiveDashboardId,
    activeNavTool,
    gridShellRef: () => gridShellRef,
    setGridViewportWidth,
    setGridViewportHeight,
    ensureWidgetsFitGrid,
    columns,
    rows,
    activeDashboardDoc,
    baseRows,
    bottomOccupiedRow,
    previousStepRef,
    step
  });

  createEffect(() => {
    // Safety cleanup so drag/resize visual state cannot get stuck.
    const clearInteraction = () => setInteraction(null);
    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") {
        clearInteraction();
      }
    };

    window.addEventListener("pointerup", clearInteraction);
    window.addEventListener("pointercancel", clearInteraction);
    window.addEventListener("mouseup", clearInteraction);
    window.addEventListener("blur", clearInteraction);
    window.addEventListener("dragend", clearInteraction);
    document.addEventListener("visibilitychange", onVisibilityChange);

    onCleanup(() => {
      window.removeEventListener("pointerup", clearInteraction);
      window.removeEventListener("pointercancel", clearInteraction);
      window.removeEventListener("mouseup", clearInteraction);
      window.removeEventListener("blur", clearInteraction);
      window.removeEventListener("dragend", clearInteraction);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    });
  });

  createEffect(() => {
    if (!configWidgetId()) return;
    const onResizeOrScroll = () => updatePanelPlacement();
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setConfigWidgetId(null);
    };
    const onPointerDownOutside = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (widgetConfigPanelRef?.contains(target)) return;
      setConfigWidgetId(null);
    };
    window.addEventListener("resize", onResizeOrScroll);
    window.addEventListener("scroll", onResizeOrScroll, true);
    window.addEventListener("keydown", onEscape);
    window.addEventListener("pointerdown", onPointerDownOutside);
    queueMicrotask(updatePanelPlacement);
    onCleanup(() => {
      window.removeEventListener("resize", onResizeOrScroll);
      window.removeEventListener("scroll", onResizeOrScroll, true);
      window.removeEventListener("keydown", onEscape);
      window.removeEventListener("pointerdown", onPointerDownOutside);
    });
  });

  useDashboardAutosave({
    dashboards,
    serverSyncReady,
    isAuthenticated: session.isAuthenticated,
    persistToStorage: persistDashboardsToStorage,
    saveToServer: saveDashboardsToServer
  });

  onMount(() => {
    void (async () => {
      try {
        if (session.isAuthenticated()) {
          const remote = await fetchDashboardsFromServer(BREAKPOINT_IDS);
          if (remote && remote.length > 0) {
            setDashboards(remote);
            setActiveDashboardId(remote[0]!.id);
          }
        }
      } finally {
        setServerSyncReady(true);
      }
    })();
  });

  const shellProps: WorkspaceShellProps = {
    activeNavTool: activeNavTool(),
    onSelectNavTool: selectNavTool,
    toolSwitchLocked: !dashboardLocked(),
    topbarCenter: () => (
        <AppTopbarCenter
          activeNavTool={activeNavTool()}
          activeToolTitle={activeToolTitle()}
          activeDashboardName={activeDashboardName()}
          dashboards={dashboards()}
          activeDashboardId={activeDashboardId()}
          dashboardMenuOpen={dashboardMenuOpen()}
          dashboardLocked={dashboardLocked()}
          dashboardSettingsOpen={dashboardSettingsOpen()}
          widgetMenuOpen={widgetMenuOpen()}
          breakpointMenuOpen={breakpointMenuOpen()}
          selectedBreakpoint={selectedBreakpoint()}
          selectedBreakpointLabel={selectedBreakpointLabel()}
          enabledBreakpointOptions={enabledBreakpointOptions()}
          widgetLibrary={widgetLibrary}
          dashboardMenuRef={(el) => {
            dashboardMenuRef = el;
          }}
          dashboardMenuButtonRef={(el) => {
            dashboardMenuButtonRef = el;
          }}
          dashboardSettingsButtonRef={(el) => {
            dashboardSettingsButtonRef = el;
          }}
          widgetMenuRef={(el) => {
            widgetMenuRef = el;
          }}
          widgetMenuButtonRef={(el) => {
            widgetMenuButtonRef = el;
          }}
          breakpointMenuRef={(el) => {
            breakpointMenuRef = el;
          }}
          breakpointMenuButtonRef={(el) => {
            breakpointMenuButtonRef = el;
          }}
          isBreakpointEnabledForActiveDashboard={isBreakpointEnabledForActiveDashboard}
          onToggleDashboardMenu={() => setDashboardMenuOpen((open) => !open)}
          onCreateDashboard={createDashboard}
          onSelectDashboard={(dashboardId) => {
            setActiveDashboardId(dashboardId);
            setDashboardLocked(true);
            setDashboardMenuOpen(false);
          }}
          onToggleDashboardSettings={() => {
            setDashboardSettingsOpen((open) => !open);
            queueMicrotask(updateDashboardSettingsPlacement);
          }}
          rollbackMenuOpen={rollback.rollbackMenuOpen()}
          rollbackBusy={rollback.rollbackBusy()}
          rollbackVersions={rollback.rollbackVersions()}
          rollbackMenuRef={(el) => {
            rollbackMenuRef = el;
          }}
          rollbackButtonRef={(el) => {
            rollbackButtonRef = el;
          }}
          onToggleRollbackMenu={() => {
            void rollback.openRollbackMenu();
          }}
          onRollbackToVersion={(timestamp) => {
            void rollback.rollbackToVersion(timestamp);
          }}
          onToggleWidgetMenu={() => setWidgetMenuOpen((open) => !open)}
          onLibraryPointerDown={(type) => {
            if (dashboardLocked()) return;
            setDraggingLibraryType(type);
          }}
          onLibraryDragStart={(event, type) => {
            if (dashboardLocked()) return;
            onLibraryDragStart(event, type);
          }}
          onLibraryDragEnd={() => {
            setDragPreview(null);
            setDraggingLibraryType(null);
            setWidgetMenuOpen(false);
          }}
          onAddWidgetFromMenu={addWidgetFromMenu}
          onAddGridPage={addGridPage}
          onToggleDashboardLocked={() => setDashboardLocked((value) => !value)}
          onToggleBreakpointMenu={() => setBreakpointMenuOpen((open) => !open)}
          onSelectBreakpoint={(breakpoint) => {
            setHasManualBreakpointSelection(true);
            setSelectedBreakpoint(breakpoint);
            setBreakpointMenuOpen(false);
          }}
          onSetDashboardBreakpointEnabled={setDashboardBreakpointEnabled}
          widgetTypeIcon={widgetTypeIcon}
        />
      ),
      topbarTools: () => (
        <AppTopbarTools
          currentClock={currentClock()}
          currentClockIso={currentClockIso()}
          topbarCustomTimeSpan={topbarCustomTimeSpan()}
          timeWindow={timeWindow()}
          timeWindowMenuOpen={timeWindowMenuOpen()}
          timeWindowMenuView={timeWindowMenuView()}
          customRangeFrom={customRangeFrom()}
          customRangeTo={customRangeTo()}
          relativePresets={RELATIVE_PRESETS}
          activeNavTool={activeNavTool()}
          userMenuOpen={userMenuOpen()}
          timeWindowButtonRef={(el) => {
            timeWindowButtonRef = el;
          }}
          timeWindowMenuRef={(el) => {
            timeWindowMenuRef = el;
          }}
          userMenuButtonRef={(el) => {
            userMenuButtonRef = el;
          }}
          userMenuRef={(el) => {
            userMenuRef = el;
          }}
          timeWindowSummaryLabel={timeWindowSummaryLabel}
          timeWindowButtonLabel={timeWindowButtonLabel}
          onToggleTimeWindowMenu={() => {
            if (timeWindowMenuOpen()) {
              setTimeWindowMenuOpen(false);
            } else {
              setTimeWindowMenuView("list");
              setTimeWindowMenuOpen(true);
            }
          }}
          onSetTimeWindowListView={() => setTimeWindowMenuView("list")}
          onSetTimeWindowCustomView={openTimeWindowCustom}
          onUpdateCustomRangeFrom={setCustomRangeFrom}
          onUpdateCustomRangeTo={setCustomRangeTo}
          onApplyCustomTimeWindow={applyTimeWindowCustom}
          onApplyRelativePreset={(presetId) => applyTimeWindow({ kind: "relative", preset: presetId })}
          onToggleUserMenu={() => setUserMenuOpen((open) => !open)}
          onOpenUserSettings={() => {
            if (!dashboardLocked()) return;
            selectNavTool("userSettings");
            setUserMenuOpen(false);
          }}
          onCloseUserMenu={() => setUserMenuOpen(false)}
        />
      ),
      main: () => (
          <DashboardMainRegion activeNavTool={activeNavTool} canAccessModule={props.canAccessModule}>
          <>
          <DashboardEditorGrid
            gridShellRef={(el) => {
              gridShellRef = el;
            }}
            gridRef={(el) => {
              gridRef = el;
            }}
            locked={dashboardLocked()}
            showGrid={showGrid()}
            gridWidth={gridWidth()}
            gridHeight={gridHeight()}
            edgePadding={edgePadding}
            step={step()}
            cellSize={cellSize()}
            columns={columns()}
            rows={rows()}
            onDragOver={handleGridDragOver}
            onDragEnter={handleGridDragOver}
            onDrop={handleGridDrop}
            widgetInset={widgetInset}
            dragPreview={
              dragPreview()
                ? {
                    colStart: dragPreview()!.colStart,
                    rowStart: dragPreview()!.rowStart,
                    colSpan: dragPreview()!.colSpan,
                    rowSpan: dragPreview()!.rowSpan,
                    label:
                      widgetLibrary.find((item) => item.id === (dragPreview()?.type ?? DEFAULT_WIDGET_TYPE))
                        ?.label ?? "Widget"
                  }
                : null
            }
            items={widgets()}
            renderItem={(widget) => (
              <DashboardWidgetCard
                widget={widget}
                widgetRefs={widgetRefs}
                interaction={interaction}
                configWidgetId={configWidgetId}
                setConfigWidgetId={setConfigWidgetId}
                updatePanelPlacement={updatePanelPlacement}
                step={step}
                widgetInset={widgetInset}
                runtimeWidgetStatus={runtimeWidgetStatus}
                runtimeWidgetValues={runtimeWidgetValues}
                getWidgetDisplayValue={getWidgetDisplayValue}
                fontSizeValue={fontSizeValue}
                textAlignValue={textAlignValue}
                dashboardLocked={dashboardLocked}
                startWidgetDrag={startWidgetDrag}
                startWidgetResize={startWidgetResize}
                deleteWidget={deleteWidget}
              />
            )}
          />

      <DashboardWidgetConfigOverlay
        panelRef={(el) => {
          widgetConfigPanelRef = el;
        }}
        open={() => !!activeWidget()}
        slideDirection={slideDirection}
        panelTop={panelTop}
        panelLeft={panelLeft}
        width={widgetPanelWidth}
        height={widgetPanelHeight}
        activeWidget={activeWidget}
        activeGaugeWidget={activeGaugeWidget}
        activeLabelWidget={activeLabelWidget}
        activeDonutWidget={activeDonutWidget}
        activeSparklineWidget={activeSparklineWidget}
        activeTimeSeriesWidget={activeTimeSeriesWidget}
        activeMapWidget={activeMapWidget}
        activeBarWidget={activeBarWidget}
        dashboardUpdateGroups={dashboardUpdateGroups}
        renderBaseWidgetSettings={renderBaseWidgetSettings}
        configWidgetId={configWidgetId}
        updateWidgetConfig={updateWidgetConfig}
      />
          </>
          </DashboardMainRegion>
      ),
      overlays: () => (
      <DashboardSettingsOverlay
        panelRef={(el) => {
          dashboardSettingsPanelRef = el;
        }}
        open={dashboardSettingsOpen()}
        top={dashboardSettingsTop()}
        left={dashboardSettingsLeft()}
        width={dashboardSettingsWidth()}
        height={dashboardSettingsHeight()}
        dashboardName={activeDashboardName()}
        updateFrequencySeconds={activeDashboardDoc()?.updateFrequencySeconds ?? 60}
        frequencyOptions={UPDATE_FREQUENCY_OPTIONS}
        deleteConfirmInput={dashboardDeleteConfirmInput()}
        onRename={renameActiveDashboard}
        onFrequencyIndexChange={updateActiveDashboardFrequencyByIndex}
        onDeleteConfirmInputChange={setDashboardDeleteConfirmInput}
        onDelete={deleteActiveDashboard}
      />
      )
  };

  return props.renderShell(shellProps);
}
