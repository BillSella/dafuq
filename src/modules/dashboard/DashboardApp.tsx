import { For, Show, createEffect, createMemo, createSignal, onCleanup, onMount } from "solid-js";
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
} from "../../dashboardStore";
import {
  loadDashboardsFromStorage,
  persistDashboardsToStorage
} from "../../dashboardPersistence";
import {
  BREAKPOINT_IDS,
  BREAKPOINT_OPTIONS,
  detectBreakpointFromViewport,
  getGridSizeForBreakpoint
} from "../../layoutService";
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
} from "../../timeWindow";
import { useSession } from "../../session/SessionContext";
import { useDismissOnOutsideClick } from "../../hooks/useDismissOnOutsideClick";
import { fetchDashboardsFromServer, saveDashboardsToServer } from "../../dashboardServerSync";
import { useDashboardRollback } from "../../dashboard/useDashboardRollback";
import { useDashboardAutosave } from "../../dashboard/useDashboardAutosave";
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
import { useDashboardManagement } from "./useDashboardManagement";
import { useDashboardRuntimeValues } from "./useDashboardRuntimeValues";
import { useDashboardTopbarTimeWindow } from "./useDashboardTopbarTimeWindow";
import { useDashboardWidgetCommands } from "./useDashboardWidgetCommands";
import { getAppModule } from "../moduleRegistry";
import type { AppModuleId } from "../moduleTypes";
import { WorkspaceShell } from "../shell/WorkspaceShell";

/**
 * Authenticated workspace: dashboard state and topbar wiring, hosted inside
 * {@link WorkspaceShell}. Re-exported as default from `App.tsx`.
 */
export default function DashboardApp() {
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
  const [activeNavTool, setActiveNavTool] = createSignal<AppModuleId>("dashboards");
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
  let previousStep = 32;
  let normalizedOnce = false;
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
    widgets().find((widget) => widget.id === configWidgetId()) ?? null
  );
  const activeGaugeWidget = createMemo(() =>
    activeWidget()?.type === "numberGauge"
      ? (activeWidget() as WidgetStateByType<"numberGauge">)
      : null
  );
  const activeLabelWidget = createMemo(() =>
    activeWidget()?.type === "label"
      ? (activeWidget() as WidgetStateByType<"label">)
      : null
  );
  const activeDonutWidget = createMemo(() =>
    activeWidget()?.type === "donutChart"
      ? (activeWidget() as WidgetStateByType<"donutChart">)
      : null
  );
  const activeBarWidget = createMemo(() =>
    activeWidget()?.type === "barChart"
      ? (activeWidget() as WidgetStateByType<"barChart">)
      : null
  );
  const activeSparklineWidget = createMemo(() =>
    activeWidget()?.type === "sparklineChart"
      ? (activeWidget() as WidgetStateByType<"sparklineChart">)
      : null
  );
  const activeTimeSeriesWidget = createMemo(() =>
    activeWidget()?.type === "timeSeriesChart"
      ? (activeWidget() as WidgetStateByType<"timeSeriesChart">)
      : null
  );
  const activeMapWidget = createMemo(() =>
    activeWidget()?.type === "mapNetwork"
      ? (activeWidget() as WidgetStateByType<"mapNetwork">)
      : null
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

  const onLibraryDragStart = (event: DragEvent, type: WidgetType) => {
    if (dashboardLocked()) return;
    bumpDebug("onLibraryDragStart", { type });
    if (!event.dataTransfer) return;
    event.dataTransfer.setData(LIBRARY_WIDGET_KEY, type);
    event.dataTransfer.effectAllowed = "copy";
    setDraggingLibraryType(type);
    const previewSeed = getWidgetFootprintForCurrentGrid(type);
    setDragPreview({
      type,
      colStart: 1,
      rowStart: 1,
      colSpan: previewSeed.colSpan,
      rowSpan: previewSeed.rowSpan
    });
  };

  const detectDraggedLibraryType = (event: DragEvent): WidgetType | null => {
    const active = draggingLibraryType();
    if (active) return active;
    const transferType = event.dataTransfer?.getData(LIBRARY_WIDGET_KEY) as WidgetType | "";
    if (transferType) return transferType;
    const hasLibraryType = event.dataTransfer?.types?.includes(LIBRARY_WIDGET_KEY);
    return hasLibraryType ? DEFAULT_WIDGET_TYPE : null;
  };

  const getCellFromPointer = (clientX: number, clientY: number) => {
    if (!gridRef) return { col: 1, row: 1 };
    const rect = gridRef.getBoundingClientRect();
    const x = clamp(clientX - rect.left, 0, rect.width - 1);
    const y = clamp(clientY - rect.top, 0, rect.height - 1);
    return {
      col: clamp(Math.floor(x / step()) + 1, 1, columns()),
      row: clamp(Math.floor(y / step()) + 1, 1, rows())
    };
  };

  const handleGridDrop = (event: DragEvent) => {
    if (dashboardLocked()) return;
    bumpDebug("handleGridDrop");
    event.preventDefault();
    const type = detectDraggedLibraryType(event) ?? "";
    if (!type) return;
    const preview = dragPreview();
    if (preview) {
      addWidgetAt(type, preview.colStart, preview.rowStart);
    } else {
      const cell = getCellFromPointer(event.clientX, event.clientY);
      addWidgetAt(type, cell.col, cell.row);
    }
    setDragPreview(null);
    setDraggingLibraryType(null);
  };

  const handleGridDragOver = (event: DragEvent) => {
    if (dashboardLocked()) return;
    bumpDebug("handleGridDragOver");
    const type = detectDraggedLibraryType(event);
    if (!type) return;
    if (!draggingLibraryType()) {
      setDraggingLibraryType(type);
    }
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "copy";
    }
    const cell = getCellFromPointer(event.clientX, event.clientY);
    const previewSeed = getWidgetFootprintForCurrentGrid(type);
    const colSpan = previewSeed.colSpan;
    const rowSpan = previewSeed.rowSpan;
    setDragPreview({
      type,
      colStart: clamp(cell.col, 1, columns() - colSpan + 1),
      rowStart: clamp(cell.row, 1, rows() - rowSpan + 1),
      colSpan,
      rowSpan
    });
  };

  const startWidgetDrag = (event: PointerEvent, widget: DashboardWidget) => {
    if (dashboardLocked()) return;
    bumpDebug("startWidgetDrag", { id: widget.id });
    if (configWidgetId() === widget.id) {
      setConfigWidgetId(null);
      return;
    }

    event.preventDefault();
    const pointerStartX = event.clientX;
    const pointerStartY = event.clientY;
    const initialCol = widget.colStart;
    const initialRow = widget.rowStart;
    setInteraction({ id: widget.id, mode: "dragging" });

    const onMove = (moveEvent: PointerEvent) => {
      const colDelta = Math.round((moveEvent.clientX - pointerStartX) / step());
      const rowDelta = Math.round((moveEvent.clientY - pointerStartY) / step());
      const maxCol = columns() - widget.colSpan + 1;
      const maxRow = rows() - widget.rowSpan + 1;
      updateWidget(widget.id, {
        colStart: clamp(initialCol + colDelta, 1, maxCol),
        rowStart: clamp(initialRow + rowDelta, 1, maxRow)
      });
      updatePanelPlacement();
    };

    const onUp = () => {
      setInteraction(null);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      window.removeEventListener("blur", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    window.addEventListener("blur", onUp);
  };

  const startWidgetResize = (event: PointerEvent, widget: DashboardWidget) => {
    if (dashboardLocked()) return;
    bumpDebug("startWidgetResize", { id: widget.id });
    event.preventDefault();
    event.stopPropagation();
    const pointerStartX = event.clientX;
    const pointerStartY = event.clientY;
    const initialColSpan = widget.colSpan;
    const initialRowSpan = widget.rowSpan;
    setInteraction({ id: widget.id, mode: "resizing" });

    const onMove = (moveEvent: PointerEvent) => {
      const colDelta = Math.round((moveEvent.clientX - pointerStartX) / step());
      const rowDelta = Math.round((moveEvent.clientY - pointerStartY) / step());
      const minSpanX = Math.max(1, Math.ceil(16 / step()));
      const minSpanY = Math.max(1, Math.ceil(16 / step()));
      const maxSpanX = columns() - widget.colStart + 1;
      const maxSpanY = rows() - widget.rowStart + 1;
      updateWidget(widget.id, {
        colSpan: clamp(initialColSpan + colDelta, minSpanX, maxSpanX),
        rowSpan: clamp(initialRowSpan + rowDelta, minSpanY, maxSpanY)
      });
      updatePanelPlacement();
    };

    const onUp = () => {
      setInteraction(null);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      window.removeEventListener("blur", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    window.addEventListener("blur", onUp);
  };

  createEffect(() => {
    if (!DEBUG_WIDGET_EVENTS) return;
    // Devtool hook: window.__widgetDebug() -> per-event counters
    (window as any).__widgetDebug = debugCounts;
  });

  createEffect(() => {
    // Normalize once in case HMR/state restore introduced non-canonical objects.
    if (normalizedOnce) return;
    normalizedOnce = true;
    setDashboards((previous) =>
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
            colStart: getWidgetPlacement(widget, selectedBreakpoint()).colStart,
            rowStart: getWidgetPlacement(widget, selectedBreakpoint()).rowStart,
            colSpan: getWidgetPlacement(widget, selectedBreakpoint()).colSpan,
            rowSpan: getWidgetPlacement(widget, selectedBreakpoint()).rowSpan,
            config: widget.config
          })
        }))
      }))
    );
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

  createEffect(() => {
    if (configWidgetId()) return;
    setVisibilityMenuOpen(false);
  });

  createEffect(() => {
    if (!dashboardLocked()) return;
    setConfigWidgetId(null);
    setDragPreview(null);
    setDraggingLibraryType(null);
    setBreakpointMenuOpen(false);
    setWidgetMenuOpen(false);
    setDashboardSettingsOpen(false);
    rollback.closeRollbackMenu();
  });

  createEffect(() => {
    if (dashboardLocked()) return;
    setDashboardMenuOpen(false);
  });

  createEffect(() => {
    setGridUnitSize(selectedGridSpec().step);
  });

  createEffect(() => {
    if (hasManualBreakpointSelection()) return;
    const width = gridViewportWidth();
    const height = gridViewportHeight();
    const detected = detectBreakpointFromViewport(width, height);
    const next =
      isBreakpointEnabledForActiveDashboard(detected)
        ? detected
        : preferredEnabledBreakpoint() ?? detected;
    if (selectedBreakpoint() !== next) {
      setSelectedBreakpoint(next);
    }
  });

  createEffect(() => {
    const current = selectedBreakpoint();
    if (isBreakpointEnabledForActiveDashboard(current)) return;
    const fallback = preferredEnabledBreakpoint();
    if (fallback) {
      setSelectedBreakpoint(fallback);
    }
  });

  useDismissOnOutsideClick({
    isOpen: userMenuOpen,
    containerRef: () => userMenuRef,
    triggerRef: () => userMenuButtonRef,
    onDismiss: () => setUserMenuOpen(false)
  });

  useDismissOnOutsideClick({
    isOpen: timeWindowMenuOpen,
    containerRef: () => timeWindowMenuRef,
    triggerRef: () => timeWindowButtonRef,
    onDismiss: () => {
      setTimeWindowMenuOpen(false);
      setTimeWindowMenuView("list");
    }
  });

  useDismissOnOutsideClick({
    isOpen: dashboardMenuOpen,
    containerRef: () => dashboardMenuRef,
    triggerRef: () => dashboardMenuButtonRef,
    onDismiss: () => setDashboardMenuOpen(false)
  });

  useDismissOnOutsideClick({
    isOpen: widgetMenuOpen,
    containerRef: () => widgetMenuRef,
    triggerRef: () => widgetMenuButtonRef,
    onDismiss: () => setWidgetMenuOpen(false)
  });

  useDismissOnOutsideClick({
    isOpen: visibilityMenuOpen,
    containerRef: () => visibilityMenuRef,
    triggerRef: () => visibilityMenuButtonRef,
    onDismiss: () => setVisibilityMenuOpen(false)
  });

  useDismissOnOutsideClick({
    isOpen: breakpointMenuOpen,
    containerRef: () => breakpointMenuRef,
    triggerRef: () => breakpointMenuButtonRef,
    onDismiss: () => setBreakpointMenuOpen(false)
  });

  useDismissOnOutsideClick({
    isOpen: rollback.rollbackMenuOpen,
    containerRef: () => rollbackMenuRef,
    triggerRef: () => rollbackButtonRef,
    onDismiss: rollback.closeRollbackMenu
  });

  createEffect(() => {
    if (!dashboardSettingsOpen()) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDashboardSettingsOpen(false);
    };
    const onPointerDownOutside = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (dashboardSettingsPanelRef?.contains(target)) return;
      if (dashboardSettingsButtonRef?.contains(target)) return;
      setDashboardSettingsOpen(false);
    };
    const onResizeOrScroll = () => updateDashboardSettingsPlacement();
    window.addEventListener("keydown", onEscape);
    window.addEventListener("pointerdown", onPointerDownOutside);
    window.addEventListener("resize", onResizeOrScroll);
    window.addEventListener("scroll", onResizeOrScroll, true);
    queueMicrotask(updateDashboardSettingsPlacement);
    onCleanup(() => {
      window.removeEventListener("keydown", onEscape);
      window.removeEventListener("pointerdown", onPointerDownOutside);
      window.removeEventListener("resize", onResizeOrScroll);
      window.removeEventListener("scroll", onResizeOrScroll, true);
    });
  });

  createEffect(() => {
    if (!dashboardSettingsOpen()) return;
    activeDashboardName();
    setDashboardDeleteConfirmInput("");
  });

  createEffect(() => {
    const docs = dashboards();
    if (docs.length === 0) return;
    const activeId = activeDashboardId();
    if (!docs.some((doc) => doc.id === activeId)) {
      setActiveDashboardId(docs[0].id);
    }
  });

  createEffect(() => {
    if (activeNavTool() !== "dashboards") return;
    if (!gridShellRef) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setGridViewportWidth(entry.contentRect.width);
      setGridViewportHeight(entry.contentRect.height);
    });
    observer.observe(gridShellRef);
    onCleanup(() => observer.disconnect());
  });

  createEffect(() => {
    if (activeNavTool() !== "dashboards") return;
    ensureWidgetsFitGrid(columns(), rows());
  });

  createEffect(() => {
    if (!dashboardLocked()) return;
    const active = activeDashboardDoc();
    if (!active) return;
    const currentDashboardId = activeDashboardId();
    const currentBreakpoint = selectedBreakpoint();
    const targetExtraRows = Math.max(0, bottomOccupiedRow() - baseRows());
    const currentExtraRows = active.extraGridRows?.[currentBreakpoint] ?? 0;
    if (currentExtraRows === targetExtraRows) return;
    setDashboards((previous) =>
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
    // Preserve approximate pixel footprint when grid unit changes.
    const currentStep = step();
    if (currentStep === previousStep) return;
    previousStep = currentStep;
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

  return (
    <WorkspaceShell
      activeNavTool={activeNavTool()}
      onSelectNavTool={setActiveNavTool}
      toolSwitchLocked={!dashboardLocked()}
      topbarCenter={() => (
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
      )}
      topbarTools={() => (
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
            setActiveNavTool("userSettings");
            setUserMenuOpen(false);
          }}
          onCloseUserMenu={() => setUserMenuOpen(false)}
        />
      )}
      main={() => (
          <DashboardMainRegion activeNavTool={activeNavTool}>
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
      )}
      overlays={() => (
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
      )}
    />
  );
}
