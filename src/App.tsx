import { For, Show, createEffect, createMemo, createSignal, onCleanup, onMount } from "solid-js";
import { type GaugeConfig } from "./widgets/gaugeWidget";
import { type LabelConfig } from "./widgets/labelWidget";
import { DonutWidget, type DonutConfig } from "./widgets/donutWidget";
import { BarWidget, type BarConfig } from "./widgets/barWidget";
import { SparklineWidget, type SparklineConfig } from "./widgets/sparklineWidget";
import { TimeSeriesWidget, type TimeSeriesConfig } from "./widgets/timeSeriesWidget";
import { MapWidget, type MapConfig } from "./widgets/mapWidget";
import { MAP_VIEW_H, MAP_VIEW_W } from "./widgets/mapProjections";
import { clamp } from "./widgets/baseWidget";
import {
  UPDATE_FREQUENCY_OPTIONS,
  createDashboardDoc,
  type DashboardBreakpoint,
  type DashboardDoc,
  type DashboardWidgetDoc,
  getWidgetDisplayConfig,
  getWidgetPlacement,
  upsertWidgetPlacement,
  type WidgetDisplayConfig,
  type WidgetPatch,
  deleteWidgetInDashboards,
  ensureWidgetsFitGridInDashboards,
  updateWidgetConfigInDashboards,
  updateWidgetInDashboards,
  updateWidgetVisibilityInDashboards
} from "./dashboardStore";
import {
  loadDashboardsFromStorage,
  persistDashboardsToStorage
} from "./dashboardPersistence";
import {
  BREAKPOINT_IDS,
  BREAKPOINT_OPTIONS,
  detectBreakpointFromViewport,
  getGridSizeForBreakpoint,
  projectPlacementAcrossBreakpoints
} from "./layoutService";
import {
  type CommonWidgetSettingsPatch,
  DEFAULT_WIDGET_TYPE,
  type WidgetConfigMap,
  type WidgetType,
  widgetLibrary,
  widgetRegistry,
  type WidgetStateByType
} from "./widgets/widgetRegistry";
import { BarSettingsForm } from "./components/config/BarSettingsForm";
import { BaseWidgetSettingsSection } from "./components/config/BaseWidgetSettingsSection";
import { DashboardSettingsOverlay } from "./components/config/DashboardSettingsOverlay";
import { DonutSettingsForm } from "./components/config/DonutSettingsForm";
import { LabelSettingsForm } from "./components/config/LabelSettingsForm";
import { MapSettingsForm } from "./components/config/MapSettingsForm";
import { NumberGaugeSettingsForm } from "./components/config/NumberGaugeSettingsForm";
import { SparklineSettingsForm } from "./components/config/SparklineSettingsForm";
import { TimeSeriesSettingsForm } from "./components/config/TimeSeriesSettingsForm";
import { OverlayPanel } from "./components/config/OverlayPanel";
import { WidgetConfigOverlayShell } from "./components/config/WidgetConfigOverlayShell";
import { AppTopbarCenter } from "./components/layout/AppTopbarCenter";
import { AppTopbarTools } from "./components/layout/AppTopbarTools";
import { DashboardEditorPane } from "./components/layout/DashboardEditorPane";
import { DashboardPlaceholderPane } from "./components/layout/DashboardPlaceholderPane";
import { LeftNavRail } from "./components/layout/LeftNavRail";
import { WidgetCanvas } from "./components/layout/WidgetCanvas";
import { ToolButton } from "./components/ui/ToolButton";
import { fetchWidgetRuntimeValue, getWidgetGroupKey } from "./widgetDataService";
import type { WidgetRuntimeStatus } from "./widgetDataService";
import {
  RELATIVE_PRESETS,
  fromDateTimeLocalValue,
  loadTimeWindowFromStorage,
  resolveTimeRange,
  saveTimeWindowToStorage,
  timeWindowButtonLabel,
  timeWindowSummaryLabel,
  toDateTimeLocalValue,
  type TimeWindowState
} from "./timeWindow";
import { DafuqLogo } from "./components/DafuqLogo";
import { useSession } from "./session/SessionContext";
import { useDismissOnOutsideClick } from "./hooks/useDismissOnOutsideClick";
import { fetchDashboardsFromServer, saveDashboardsToServer } from "./dashboardServerSync";
import { useDashboardRollback } from "./dashboard/useDashboardRollback";
import { useDashboardAutosave } from "./dashboard/useDashboardAutosave";
import { DashboardModule } from "./modules/dashboard/DashboardModule";
import { getAppModule, getModulePlaceholderMessage } from "./modules/moduleRegistry";
import type { AppModuleId } from "./modules/moduleTypes";

/**
 * Dashboard editor shell:
 * - renders grid + widgets
 * - handles drag/drop, move, resize
 * - manages widget settings panel
 */
type SlideDirection = "left" | "right" | "top" | "bottom";
const LIBRARY_WIDGET_KEY = "application/x-dashboard-widget";
type DashboardWidget = WidgetStateByType;
const DEBUG_WIDGET_EVENTS = true;
const WIDGET_SETTINGS_LEFT_COLUMN_WIDTH = 450;
const WIDGET_SETTINGS_RIGHT_COLUMN_WIDTH = 840;
const WIDGET_SETTINGS_DIVIDER_WIDTH = 1;
const WIDGET_SETTINGS_COLUMN_GAP = 12;
const WIDGET_SETTINGS_PANEL_CHROME = 32;

function widgetTypeIcon(type: WidgetType): string {
  switch (type) {
    case "numberGauge":
      return "◔";
    case "label":
      return "T";
    case "donutChart":
      return "◍";
    case "barChart":
      return "▤";
    case "sparklineChart":
      return "⤴";
    case "timeSeriesChart":
      return "⏱";
    case "mapNetwork":
      return "◎";
    default:
      return "•";
  }
}

function App() {
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
  const [timeWindow, setTimeWindow] = createSignal<TimeWindowState>(loadTimeWindowFromStorage());
  const [timeWindowMenuOpen, setTimeWindowMenuOpen] = createSignal(false);
  const [timeWindowMenuView, setTimeWindowMenuView] = createSignal<"list" | "custom">("list");
  const [customRangeFrom, setCustomRangeFrom] = createSignal("");
  const [customRangeTo, setCustomRangeTo] = createSignal("");
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
  const [runtimeWidgetValues, setRuntimeWidgetValues] = createSignal<Record<string, string>>({});
  const [runtimeWidgetStatus, setRuntimeWidgetStatus] = createSignal<Record<string, WidgetRuntimeStatus>>({});

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
  let idCounter = 2;
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

  const applyTimeWindow = (next: TimeWindowState) => {
    setTimeWindow(next);
    saveTimeWindowToStorage(next);
    setTimeWindowMenuOpen(false);
    setTimeWindowMenuView("list");
  };

  const openTimeWindowCustom = () => {
    const tw = timeWindow();
    if (tw.kind === "absolute") {
      setCustomRangeFrom(toDateTimeLocalValue(tw.fromMs));
      setCustomRangeTo(toDateTimeLocalValue(tw.toMs));
    } else {
      const r = resolveTimeRange(tw);
      setCustomRangeFrom(toDateTimeLocalValue(r.fromMs));
      setCustomRangeTo(toDateTimeLocalValue(r.toMs));
    }
    setTimeWindowMenuView("custom");
  };

  const applyTimeWindowCustom = () => {
    let a = fromDateTimeLocalValue(customRangeFrom());
    let b = fromDateTimeLocalValue(customRangeTo());
    if (a == null || b == null) return;
    if (a === b) b = a + 60_000;
    applyTimeWindow({ kind: "absolute", fromMs: Math.min(a, b), toMs: Math.max(a, b) });
  };

  const formatLocalClock = () =>
    new Date().toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit"
    });
  const formatTopbarRangePoint = (ms: number) =>
    new Date(ms).toLocaleString(undefined, {
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });
  const [currentClock, setCurrentClock] = createSignal(formatLocalClock());
  const currentClockIso = createMemo(() => {
    currentClock();
    return new Date().toISOString();
  });
  const topbarCustomTimeSpan = createMemo(() => {
    const tw = timeWindow();
    if (tw.kind !== "absolute") return "";
    const { fromMs, toMs } = resolveTimeRange(tw);
    return `${formatTopbarRangePoint(fromMs)} - ${formatTopbarRangePoint(toMs)}`;
  });
  createEffect(() => {
    setCurrentClock(formatLocalClock());
    const t = window.setInterval(() => setCurrentClock(formatLocalClock()), 1000);
    onCleanup(() => clearInterval(t));
  });

  const createDashboard = () => {
    const existing = dashboards().map((dashboard) => dashboard.name);
    let nextIndex = existing.length + 1;
    let candidate = `Dashboard ${nextIndex}`;
    const existingSet = new Set(existing);
    while (existingSet.has(candidate)) {
      nextIndex += 1;
      candidate = `Dashboard ${nextIndex}`;
    }
    const nextDashboard = createDashboardDoc(candidate, false, BREAKPOINT_IDS);
    setDashboards((previous) => [...previous, nextDashboard]);
    setActiveDashboardId(nextDashboard.id);
    setSelectedBreakpoint("desktopFhd");
    setHasManualBreakpointSelection(true);
    setDashboardLocked(false);
    setDashboardMenuOpen(false);
    setDashboardSettingsOpen(true);
    queueMicrotask(updateDashboardSettingsPlacement);
  };

  const renameActiveDashboard = (nextName: string) => {
    const currentId = activeDashboardId();
    setDashboards((previous) =>
      previous.map((dashboard) =>
        dashboard.id === currentId ? { ...dashboard, name: nextName } : dashboard
      )
    );
  };

  const setDashboardBreakpointEnabled = (breakpoint: DashboardBreakpoint, enabled: boolean) => {
    if (dashboardLocked()) return;
    const currentDashboardId = activeDashboardId();
    if (!currentDashboardId) return;
    const active = activeDashboardDoc();
    if (!active) return;
    const currentlyEnabled = BREAKPOINT_OPTIONS.filter(
      (option) => active.enabledBreakpoints?.[option.id] ?? true
    );
    if (!enabled && currentlyEnabled.length <= 1 && currentlyEnabled[0]?.id === breakpoint) {
      return;
    }
    setDashboards((previous) =>
      previous.map((dashboard) =>
        dashboard.id === currentDashboardId
          ? {
              ...dashboard,
              enabledBreakpoints: {
                ...dashboard.enabledBreakpoints,
                [breakpoint]: enabled
              }
            }
          : dashboard
      )
    );
    if (!enabled && selectedBreakpoint() === breakpoint) {
      const fallback =
        (BREAKPOINT_OPTIONS.find(
          (option) =>
            option.id === "desktopFhd" &&
            option.id !== breakpoint &&
            (active.enabledBreakpoints?.[option.id] ?? true)
        )?.id ??
          BREAKPOINT_OPTIONS.find(
            (option) =>
              option.id !== breakpoint && (active.enabledBreakpoints?.[option.id] ?? true)
          )?.id ??
          BREAKPOINT_OPTIONS[0].id) as DashboardBreakpoint;
      setSelectedBreakpoint(fallback);
      setHasManualBreakpointSelection(true);
    }
  };

  const updateActiveDashboardFrequencyByIndex = (nextIndex: number) => {
    const currentId = activeDashboardId();
    const clampedIndex = clamp(nextIndex, 0, UPDATE_FREQUENCY_OPTIONS.length - 1);
    const snapped = UPDATE_FREQUENCY_OPTIONS[clampedIndex] ?? UPDATE_FREQUENCY_OPTIONS[0];
    setDashboards((previous) =>
      previous.map((dashboard) =>
        dashboard.id === currentId
          ? { ...dashboard, updateFrequencySeconds: snapped }
          : dashboard
      )
    );
  };

  const deleteActiveDashboard = () => {
    const currentId = activeDashboardId();
    const remaining = dashboards().filter((dashboard) => dashboard.id !== currentId);
    if (remaining.length === 0) {
      const fallback = createDashboardDoc("Dashboard 1", false, BREAKPOINT_IDS);
      setDashboards([fallback]);
      setActiveDashboardId(fallback.id);
      setSelectedBreakpoint("desktopFhd");
      setHasManualBreakpointSelection(true);
    } else {
      setDashboards(remaining);
      setActiveDashboardId(remaining[0].id);
    }
    setDashboardLocked(true);
    setDashboardDeleteConfirmInput("");
    setDashboardSettingsOpen(false);
  };

  const addWidgetFromMenu = (type: WidgetType) => {
    const count = widgets().length;
    const footprint = getWidgetFootprintForCurrentGrid(type);
    const gapUnits = 1;
    const laneWidth = Math.max(footprint.colSpan + gapUnits, Math.floor(columns() / 2));
    const col = 1 + (count % 2) * laneWidth;
    const row = 1 + Math.floor(count / 2) * (footprint.rowSpan + gapUnits);
    addWidgetAt(type, col, row);
    setWidgetMenuOpen(false);
  };

  const addGridPage = () => {
    if (dashboardLocked()) return;
    const currentDashboardId = activeDashboardId();
    const currentBreakpoint = selectedBreakpoint();
    const pageRows = baseRows();
    setDashboards((previous) =>
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

  const updateDashboardSettingsPlacement = () => {
    if (!dashboardSettingsOpen()) return;
    if (!gridRef) return;
    const panelWidth = dashboardSettingsWidth();
    const panelHeight = dashboardSettingsHeight();
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
    setDashboardSettingsLeft(centeredLeft);
    setDashboardSettingsTop(centeredTop);
  };

  const updateWidget = (id: string, patch: WidgetPatch) => {
    bumpDebug("updateWidget", { id, patch });
    const currentDashboardId = activeDashboardId();
    const currentBreakpoint = selectedBreakpoint();
    setDashboards((previous) =>
      updateWidgetInDashboards(previous, currentDashboardId, currentBreakpoint, id, patch)
    );
  };

  const updateWidgetConfig = (
    id: string,
    patch: Partial<WidgetConfigMap[WidgetType]> | CommonWidgetSettingsPatch
  ) => {
    bumpDebug("updateWidgetConfig", { id, patch });
    const currentDashboardId = activeDashboardId();
    const currentBreakpoint = selectedBreakpoint();
    setDashboards((previous) =>
      updateWidgetConfigInDashboards(previous, currentDashboardId, currentBreakpoint, id, patch)
    );
  };

  const updateWidgetVisibility = (
    id: string,
    breakpoint: DashboardBreakpoint,
    visible: boolean
  ) => {
    const currentDashboardId = activeDashboardId();
    setDashboards((previous) =>
      updateWidgetVisibilityInDashboards(previous, currentDashboardId, id, breakpoint, visible)
    );
  };

  const deleteWidget = (id: string) => {
    bumpDebug("deleteWidget", { id });
    const currentDashboardId = activeDashboardId();
    setDashboards((previous) => deleteWidgetInDashboards(previous, currentDashboardId, id));
    if (configWidgetId() === id) {
      setConfigWidgetId(null);
    }
  };

  const getWidgetFootprintForCurrentGrid = (type: WidgetType): { colSpan: number; rowSpan: number } => {
    const base = widgetRegistry[type].createState("size-probe", 1, 1);
    const LEGACY_STEP = 16;
    const minSpan = Math.max(1, Math.ceil(16 / Math.max(1, step())));
    return {
      colSpan: clamp(
        Math.max(minSpan, Math.round((base.colSpan * LEGACY_STEP) / Math.max(1, step()))),
        minSpan,
        columns()
      ),
      rowSpan: clamp(
        Math.max(minSpan, Math.round((base.rowSpan * LEGACY_STEP) / Math.max(1, step()))),
        minSpan,
        rows()
      )
    };
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

  const addWidgetAt = (type: WidgetType, col: number, row: number) => {
    const id = `widget-${idCounter++}-${crypto.randomUUID()}`;
    const baseState = widgetRegistry[type].createState(id, col, row);
    const footprint = getWidgetFootprintForCurrentGrid(type);
    const colStart = clamp(baseState.colStart, 1, columns() - footprint.colSpan + 1);
    const rowStart = clamp(baseState.rowStart, 1, rows() - footprint.rowSpan + 1);
    const currentBreakpoint = selectedBreakpoint();
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
        gridViewportWidth(),
        gridViewportHeight()
      ),
      display: BREAKPOINT_IDS.map((breakpoint) => ({
        breakpoint,
        ...widgetRegistry[nextState.type].getDisplayConfigFromConfig(nextState.config)
      }))
    };
    const currentDashboardId = activeDashboardId();
    setDashboards((previous) =>
      previous.map((dashboard) =>
        dashboard.id === currentDashboardId
          ? { ...dashboard, widgets: [...dashboard.widgets, widgetDoc] }
          : dashboard
      )
    );
    setConfigWidgetId(id);
    queueMicrotask(updatePanelPlacement);
  };

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
    if (activeNavTool() !== "dashboards") return;
    const active = activeDashboardDoc();
    if (!active) return;
    void timeWindow();
    const widgetIds = new Set(active.widgets.map((widget) => widget.id));
    setRuntimeWidgetValues((previous) =>
      Object.fromEntries(Object.entries(previous).filter(([widgetId]) => widgetIds.has(widgetId)))
    );
    setRuntimeWidgetStatus((previous) =>
      Object.fromEntries(Object.entries(previous).filter(([widgetId]) => widgetIds.has(widgetId)))
    );

    const controller = new AbortController();
    let disposed = false;
    const runFetchCycle = async () => {
      if (disposed) return;
      const timeRange = resolveTimeRange(timeWindow());
      const groups = new Map<string, DashboardWidgetDoc[]>();
      active.widgets.forEach((widget) => {
        const key = getWidgetGroupKey(widget);
        const group = groups.get(key) ?? [];
        group.push(widget);
        groups.set(key, group);
      });

      const nextValues: Record<string, string> = {};
      const nextStatuses: Record<string, WidgetRuntimeStatus> = {};
      await Promise.all(
        Array.from(groups.values()).map(async (widgetsInGroup) => {
          const resolved = await Promise.all(
            widgetsInGroup.map(async (widget) => ({
              id: widget.id,
              result: await fetchWidgetRuntimeValue(widget, controller.signal, timeRange)
            }))
          );
          resolved.forEach((entry) => {
            nextValues[entry.id] = entry.result.value;
            nextStatuses[entry.id] = entry.result.status;
          });
        })
      );
      if (disposed) return;
      setRuntimeWidgetValues((previous) => ({ ...previous, ...nextValues }));
      setRuntimeWidgetStatus((previous) => ({ ...previous, ...nextStatuses }));
    };

    void runFetchCycle();
    const intervalSeconds = Math.max(1, active.updateFrequencySeconds ?? 60);
    const intervalId = window.setInterval(() => {
      void runFetchCycle();
    }, intervalSeconds * 1000);

    onCleanup(() => {
      disposed = true;
      controller.abort();
      window.clearInterval(intervalId);
    });
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
    <div class="app-shell">
      <header class="app-topbar">
        <div class="app-topbar-logo" title="dafuq">
          <DafuqLogo />
        </div>
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
      </header>

      <div class="app-main">
        <LeftNavRail
          activeNavTool={activeNavTool()}
          toolSwitchLocked={!dashboardLocked()}
          onSelectNavTool={setActiveNavTool}
        />

        <main class="dashboard-host">
          <Show
            when={activeNavTool() === "dashboards"}
            fallback={
              <DashboardPlaceholderPane message={getModulePlaceholderMessage(activeNavTool())} />
            }
          >
            <DashboardModule>
          <>
          <DashboardEditorPane
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
          >
            <WidgetCanvas
              items={widgets()}
              renderItem={(widget) => {
                const valueText = createMemo(() => getWidgetDisplayValue(widget));
                const isGauge = () => widget.type === "numberGauge";
                const isDonut = () => widget.type === "donutChart";
                const isBar = () => widget.type === "barChart";
                const isSpark = () => widget.type === "sparklineChart";
                const isTime = () => widget.type === "timeSeriesChart";
                const isMap = () => widget.type === "mapNetwork";
                const runtimeStatus = () => runtimeWidgetStatus()[widget.id] ?? "fallback";
                const donutProgress = createMemo(() => {
                  if (!isDonut()) return 0;
                  const donutState = widget as WidgetStateByType<"donutChart">;
                  return new DonutWidget({
                    ...donutState,
                    config: {
                      ...donutState.config,
                      defaultValue: runtimeWidgetValues()[widget.id] ?? donutState.config.defaultValue
                    }
                  }).getRatio();
                });
                const donutSeries = createMemo(() => {
                  if (!isDonut()) return [] as ReturnType<DonutWidget["getSeries"]>;
                  const donutState = widget as WidgetStateByType<"donutChart">;
                  return new DonutWidget({
                    ...donutState,
                    config: {
                      ...donutState.config,
                      defaultValue: runtimeWidgetValues()[widget.id] ?? donutState.config.defaultValue
                    }
                  }).getSeries();
                });
                const donutGradient = createMemo(() => {
                  const series = donutSeries();
                  if (series.length <= 1) return "";
                  const palette = [
                    "#d1ff52",
                    "#60a5fa",
                    "#f59e0b",
                    "#f472b6",
                    "#34d399",
                    "#a78bfa",
                    "#fb7185",
                    "#22d3ee"
                  ];
                  let cursor = 0;
                  const stops = series.map((item, index) => {
                    const start = cursor * 100;
                    cursor += item.ratio;
                    const end = cursor * 100;
                    return `${palette[index % palette.length]} ${start}% ${end}%`;
                  });
                  return `conic-gradient(${stops.join(", ")})`;
                });
                const donutCircumference = 2 * Math.PI * 44;
                const donutRingWidth = createMemo(() =>
                  Math.max(6, Math.min(25, Number((widget.config as DonutConfig).ringWidth ?? 13)))
                );
                const donutHolePercent = createMemo(() =>
                  Math.max(24, Math.min(88, 100 - donutRingWidth() * 2))
                );
                const donutStrokeWidth = createMemo(() =>
                  Math.max(4, Math.min(24, (88 * donutRingWidth()) / 100))
                );
                const barRatio = createMemo(() => {
                  if (!isBar()) return 0;
                  const barState = widget as WidgetStateByType<"barChart">;
                  return new BarWidget({
                    ...barState,
                    config: {
                      ...barState.config,
                      defaultValue: runtimeWidgetValues()[widget.id] ?? barState.config.defaultValue
                    }
                  }).getRatio();
                });
                const barSeries = createMemo(() => {
                  if (!isBar()) return [] as ReturnType<BarWidget["getSeries"]>;
                  const barState = widget as WidgetStateByType<"barChart">;
                  return new BarWidget({
                    ...barState,
                    config: {
                      ...barState.config,
                      defaultValue: runtimeWidgetValues()[widget.id] ?? barState.config.defaultValue
                    }
                  }).getSeries();
                });
                const barOrientation = createMemo(() =>
                  isBar() ? (widget.config as BarConfig).orientation : "horizontal"
                );
                const sparklinePaths = createMemo(() => {
                  if (!isSpark()) return { line: "", area: "" };
                  const sparkState = widget as WidgetStateByType<"sparklineChart">;
                  const instance = new SparklineWidget({
                    ...sparkState,
                    config: {
                      ...sparkState.config,
                      defaultValue: runtimeWidgetValues()[widget.id] ?? sparkState.config.defaultValue
                    }
                  });
                  const pts = instance.getPathPoints();
                  if (pts.length < 2) return { line: "", area: "" };
                  const first = pts[0]!;
                  const last = pts[pts.length - 1]!;
                  const lineD = `M ${first.x} ${first.y}` + pts
                    .slice(1)
                    .map((p) => ` L ${p.x} ${p.y}`)
                    .join("");
                  let areaD = `M ${first.x} 100 L ${first.x} ${first.y}`;
                  for (let i = 1; i < pts.length; i++) {
                    const p = pts[i]!;
                    areaD += ` L ${p.x} ${p.y}`;
                  }
                  areaD += ` L ${last.x} 100 Z`;
                  return { line: lineD, area: areaD };
                });
                const timeSeriesViz = createMemo(() => {
                  if (!isTime()) {
                    return {
                      series: [] as {
                        name: string;
                        line: string;
                        area: string;
                        color: string;
                      }[],
                      x: ["—", "—", "—"] as [string, string, string],
                      y: { min: "0", mid: "0", max: "0" },
                      hasLine: false
                    };
                  }
                  const tsState = widget as WidgetStateByType<"timeSeriesChart">;
                  const instance = new TimeSeriesWidget({
                    ...tsState,
                    config: {
                      ...tsState.config,
                      defaultValue: runtimeWidgetValues()[widget.id] ?? tsState.config.defaultValue
                    }
                  });
                  const series = instance.getPathLayers();
                  return {
                    series,
                    x: instance.getXAxisLabels(),
                    y: instance.getYAxisLabels(),
                    hasLine: series.some((s) => s.line.length > 0)
                  };
                });
                const mapViz = createMemo(() => {
                  if (!isMap()) {
                    return {
                      basemap: "",
                      nodes: [] as { id: string; x: number; y: number; r: number; color: string; value: number }[],
                      links: [] as { d: string; color: string; width: number; dash: string }[]
                    };
                  }
                  const mapState = widget as WidgetStateByType<"mapNetwork">;
                  const instance = new MapWidget({
                    ...mapState,
                    config: {
                      ...mapState.config,
                      defaultValue: runtimeWidgetValues()[widget.id] ?? mapState.config.defaultValue
                    }
                  });
                  const { nodes, links } = instance.getViz();
                  return { basemap: instance.getBasemapD(), nodes, links };
                });

                return (
                  <div
                    ref={(element) => widgetRefs.set(widget.id, element)}
                    class={
                      isGauge()
                        ? "number-gauge"
                        : isDonut()
                          ? "donut-chart"
                          : isBar()
                            ? "bar-chart"
                            : isMap()
                              ? "map-network-widget"
                              : isTime()
                                ? "time-series-chart"
                                : isSpark()
                                  ? "sparkline-chart"
                                  : "text-label"
                    }
                    classList={{
                      dragging:
                        interaction()?.id === widget.id &&
                        interaction()?.mode === "dragging",
                      resizing:
                        interaction()?.id === widget.id &&
                        interaction()?.mode === "resizing",
                      editing: configWidgetId() === widget.id,
                      "runtime-live": runtimeStatus() === "live",
                      "runtime-fallback": runtimeStatus() === "fallback",
                      "runtime-error": runtimeStatus() === "error",
                      "runtime-static": runtimeStatus() === "static"
                    }}
                    style={{
                      left: `${(widget.colStart - 1) * step() + widgetInset}px`,
                      top: `${(widget.rowStart - 1) * step() + widgetInset}px`,
                      width: `${Math.max(1, widget.colSpan * step() - widgetInset * 2)}px`,
                      height: `${Math.max(1, widget.rowSpan * step() - widgetInset * 2)}px`,
                      "--donut-size": `${Math.max(
                        24,
                        Math.min(
                          Math.max(1, widget.colSpan * step() - widgetInset * 2),
                          Math.max(1, widget.rowSpan * step() - widgetInset * 2)
                        ) - 16
                      )}px`,
                      "font-size": fontSizeValue(
                        "fontSize" in widget.config && widget.config.fontSize
                          ? widget.config.fontSize
                          : "medium"
                      )
                    }}
                    onPointerDown={(event) => startWidgetDrag(event, widget)}
                  >
                    <button
                      class="config-toggle"
                      type="button"
                      aria-label="Configure widget"
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={(event) => {
                        if (dashboardLocked()) return;
                        event.stopPropagation();
                        setConfigWidgetId(configWidgetId() === widget.id ? null : widget.id);
                        queueMicrotask(updatePanelPlacement);
                      }}
                    >
                      ⚙
                    </button>
                    {isGauge() ? (
                      <>
                        <div
                          class="gauge-source"
                          style={{ "text-align": textAlignValue((widget.config as GaugeConfig).align) }}
                        >
                          {(widget.config as GaugeConfig).label}
                        </div>
                        <div class="gauge-value">
                          {valueText()}
                        </div>
                      </>
                    ) : isDonut() ? (
                      <div class="donut-chart-body">
                        <div class="donut-visual-shell">
                          {donutSeries().length > 1 ? (
                            <>
                              <div class="donut-multi-ring" style={{ background: donutGradient() }} />
                              <div
                                class="donut-multi-hole"
                                style={{
                                  width: `${donutHolePercent()}%`,
                                  height: `${donutHolePercent()}%`
                                }}
                              />
                            </>
                          ) : (
                            <svg class="donut-chart-svg" viewBox="0 0 120 120" aria-hidden="true">
                              <circle
                                class="donut-track"
                                cx="60"
                                cy="60"
                                r="44"
                                style={{ "stroke-width": String(donutStrokeWidth()) }}
                              />
                              <circle
                                class="donut-progress"
                                cx="60"
                                cy="60"
                                r="44"
                                style={{ "stroke-width": String(donutStrokeWidth()) }}
                                stroke-dasharray={`${donutCircumference} ${donutCircumference}`}
                                stroke-dashoffset={`${donutCircumference * (1 - donutProgress())}`}
                              />
                            </svg>
                          )}
                        </div>
                        <div class="donut-center">
                          <div class="donut-value">
                            {donutSeries().length > 1
                              ? donutSeries()
                                  .reduce((sum, item) => sum + item.value, 0)
                                  .toFixed((widget.config as DonutConfig).decimals)
                              : valueText()}
                          </div>
                          <div
                            class="donut-label"
                            style={{ "text-align": (widget.config as DonutConfig).align }}
                          >
                            {(widget.config as DonutConfig).label}
                          </div>
                        </div>
                      </div>
                    ) : isSpark() ? (
                      <div class="sparkline-chart-body">
                        <div class="sparkline-header">
                          <span
                            class="sparkline-label"
                            style={{ "text-align": (widget.config as SparklineConfig).align }}
                          >
                            {(widget.config as SparklineConfig).label}
                          </span>
                          <span class="sparkline-latest">{valueText()}</span>
                        </div>
                        <div class="sparkline-visual">
                          <svg
                            class="sparkline-svg"
                            viewBox="0 0 100 100"
                            preserveAspectRatio="none"
                            aria-hidden="true"
                          >
                            {sparklinePaths().area && (widget.config as SparklineConfig).showFill ? (
                              <path
                                class="sparkline-area"
                                d={sparklinePaths().area}
                              />
                            ) : null}
                            {sparklinePaths().line ? (
                              <path
                                class="sparkline-stroke"
                                d={sparklinePaths().line}
                                fill="none"
                                style={{
                                  "stroke-width": String(
                                    Math.max(
                                      0.35,
                                      Math.min(2.2, (widget.config as SparklineConfig).strokeWidth / 2.2)
                                    )
                                  )
                                }}
                              />
                            ) : (
                              <text
                                class="sparkline-empty"
                                x="50"
                                y="55"
                                text-anchor="middle"
                              >
                                No data
                              </text>
                            )}
                          </svg>
                        </div>
                      </div>
                    ) : isBar() ? (
                      <div class="bar-chart-body">
                        <div class="bar-chart-header">
                          <span
                            class="bar-chart-label"
                            style={{ "text-align": (widget.config as BarConfig).align }}
                          >
                            {(widget.config as BarConfig).label}
                          </span>
                        </div>
                        <div
                          class="bar-series"
                          classList={{
                            horizontal: barOrientation() === "horizontal",
                            vertical: barOrientation() === "vertical"
                          }}
                        >
                          <For each={barSeries().length > 0 ? barSeries() : [{ label: "Item 1", value: 0, ratio: barRatio(), formatted: valueText() }]}>
                            {(entry) => (
                              <div class="bar-item">
                                <div class="bar-item-label" title={entry.label}>{entry.label}</div>
                                <div class="bar-track">
                                  <div
                                    class="bar-fill"
                                    style={
                                      barOrientation() === "horizontal"
                                        ? { width: `${Math.round(entry.ratio * 100)}%` }
                                        : { height: `${Math.max(2, Math.round(entry.ratio * 100))}%` }
                                    }
                                  />
                                </div>
                                <div class="bar-item-value">{entry.formatted}</div>
                              </div>
                            )}
                          </For>
                        </div>
                      </div>
                    ) : isMap() ? (
                      <div class="map-network-body">
                        <div
                          class="map-network-header"
                          style={{ "text-align": (widget.config as MapConfig).align }}
                        >
                          {(widget.config as MapConfig).label}
                        </div>
                        <div class="map-network-visual">
                          <svg
                            class="map-network-svg"
                            viewBox={`0 0 ${MAP_VIEW_W} ${MAP_VIEW_H}`}
                            preserveAspectRatio="xMidYMid meet"
                            aria-hidden="true"
                          >
                            <rect
                              class="map-network-ocean"
                              x="0"
                              y="0"
                              width={MAP_VIEW_W}
                              height={MAP_VIEW_H}
                            />
                            <path class="map-network-land" d={mapViz().basemap} />
                            <For each={mapViz().links}>
                              {(L) => (
                                <path
                                  class="map-network-link"
                                  d={L.d}
                                  fill="none"
                                  style={{
                                    stroke: L.color,
                                    "stroke-width": String(L.width),
                                    ...(L.dash ? { "stroke-dasharray": L.dash } : {}),
                                    "stroke-linecap": "round",
                                    "stroke-linejoin": "round"
                                  }}
                                />
                              )}
                            </For>
                            <For each={mapViz().nodes}>
                              {(N) => (
                                <circle
                                  class="map-network-node"
                                  cx={N.x}
                                  cy={N.y}
                                  r={N.r}
                                  fill={N.color}
                                />
                              )}
                            </For>
                          </svg>
                        </div>
                        <div class="map-network-footer" aria-hidden="true">
                          {valueText()}
                        </div>
                      </div>
                    ) : isTime() ? (
                      <div class="time-series-chart-body">
                        <div class="time-series-header">
                          <span
                            class="time-series-title"
                            style={{ "text-align": (widget.config as TimeSeriesConfig).align }}
                          >
                            {(widget.config as TimeSeriesConfig).label}
                          </span>
                        </div>
                        {timeSeriesViz().series.length > 1 ? (
                          <div class="time-series-legend" aria-hidden="true">
                            <For each={timeSeriesViz().series}>
                              {(s) => (
                                <span class="time-series-legend-item" title={s.name}>
                                  <span
                                    class="time-series-legend-swatch"
                                    style={{ "background-color": s.color }}
                                  />
                                  <span class="time-series-legend-name">{s.name}</span>
                                </span>
                              )}
                            </For>
                          </div>
                        ) : null}
                        <div class="time-series-plot-row">
                          <div class="time-series-y-ticks" aria-hidden="true">
                            <span>{timeSeriesViz().y.max}</span>
                            <span>{timeSeriesViz().y.mid}</span>
                            <span>{timeSeriesViz().y.min}</span>
                          </div>
                          <div class="time-series-svg-wrap">
                            <svg
                              class="time-series-svg"
                              viewBox="0 0 100 100"
                              preserveAspectRatio="none"
                              aria-hidden="true"
                            >
                              {(widget.config as TimeSeriesConfig).showGrid ? (
                                <g class="time-series-grid" opacity="0.35">
                                  <line x1="0" y1="0" x2="100" y2="0" />
                                  <line x1="0" y1="25" x2="100" y2="25" />
                                  <line x1="0" y1="50" x2="100" y2="50" />
                                  <line x1="0" y1="75" x2="100" y2="75" />
                                  <line x1="0" y1="100" x2="100" y2="100" />
                                </g>
                              ) : null}
                              {(widget.config as TimeSeriesConfig).showFill ? (
                                <For
                                  each={timeSeriesViz().series.filter((s) => s.area.length > 0)}
                                >
                                  {(s) => (
                                    <path
                                      class="time-series-area-path"
                                      d={s.area}
                                      fill={s.color}
                                      style={{
                                        opacity:
                                          timeSeriesViz().series.length <= 1
                                            ? 0.2
                                            : (widget.config as TimeSeriesConfig).stacked
                                              ? 0.24
                                              : 0.12
                                      }}
                                    />
                                  )}
                                </For>
                              ) : null}
                              {timeSeriesViz().hasLine ? (
                                <For
                                  each={timeSeriesViz().series.filter((s) => s.line.length > 0)}
                                >
                                  {(s) => (
                                    <path
                                      d={s.line}
                                      fill="none"
                                      class="time-series-stroke"
                                      style={{
                                        stroke: s.color,
                                        "stroke-width": String(
                                          Math.max(
                                            0.35,
                                            Math.min(
                                              2,
                                              (widget.config as TimeSeriesConfig).strokeWidth / 2.4
                                            )
                                          )
                                        )
                                      }}
                                    />
                                  )}
                                </For>
                              ) : (
                                <text
                                  class="time-series-empty"
                                  x="50"
                                  y="55"
                                  text-anchor="middle"
                                >
                                  No data
                                </text>
                              )}
                            </svg>
                          </div>
                        </div>
                        <div class="time-series-x-ticks" aria-hidden="true">
                          <span title={timeSeriesViz().x[0]}>{timeSeriesViz().x[0]}</span>
                          <span title={timeSeriesViz().x[1]}>{timeSeriesViz().x[1]}</span>
                          <span title={timeSeriesViz().x[2]}>{timeSeriesViz().x[2]}</span>
                        </div>
                      </div>
                    ) : (
                      <div
                        class="label-value"
                        style={{ "text-align": (widget.config as LabelConfig).align }}
                      >
                        {valueText()}
                      </div>
                    )}
                    <button
                      class="resize-handle"
                      type="button"
                      onPointerDown={(event) => startWidgetResize(event, widget)}
                    />
                    <button
                      class="delete-handle"
                      type="button"
                      aria-label="Delete widget"
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={(event) => {
                        if (dashboardLocked()) return;
                        event.stopPropagation();
                        deleteWidget(widget.id);
                      }}
                    >
                      🗑
                    </button>
                  </div>
                );
              }}
            />
          </DashboardEditorPane>

      <WidgetConfigOverlayShell
        panelRef={(el) => {
          widgetConfigPanelRef = el;
        }}
        open={!!activeWidget()}
        slideDirection={slideDirection()}
        top={panelTop()}
        left={panelLeft()}
        width={widgetPanelWidth()}
        height={widgetPanelHeight()}
      >
        {activeWidget()?.type === "numberGauge" ? (
          <NumberGaugeSettingsForm
            config={
              activeGaugeWidget()?.config ?? {
                label: "Primary Sensor",
                fontSize: "medium",
                align: "center",
                apiEndpoint: "",
                field: "",
                defaultValue: "72",
                decimalPlaces: 1,
                format: "full",
                updateGroup: ""
              }
            }
            dashboardUpdateGroups={dashboardUpdateGroups()}
            baseSettings={renderBaseWidgetSettings("label")}
            onPatch={(patch) => {
              const id = configWidgetId();
              if (!id) return;
              updateWidgetConfig(id, patch);
            }}
          />
        ) : activeWidget()?.type === "label" ? (
          <LabelSettingsForm
            config={
              activeLabelWidget()?.config ?? {
                sourceMode: "static",
                align: "center",
                staticText: "Label Text",
                apiEndpoint: "",
                field: "",
                fallbackText: "No Data",
                updateGroup: ""
              }
            }
            dashboardUpdateGroups={dashboardUpdateGroups()}
            baseSettings={renderBaseWidgetSettings("staticText")}
            onPatch={(patch) => {
              const id = configWidgetId();
              if (!id) return;
              updateWidgetConfig(id, patch);
            }}
          />
        ) : activeWidget()?.type === "donutChart" ? (
          <DonutSettingsForm
            config={
              activeDonutWidget()?.config ?? {
                label: "Utilization",
                align: "center",
                ringWidth: 13,
                min: 0,
                max: 100,
                decimals: 1,
                format: "compact",
                defaultValue: "",
                seriesLabelField: "label",
                seriesValueField: "value",
                updateGroup: "",
                apiEndpoint: "",
                field: ""
              }
            }
            dashboardUpdateGroups={dashboardUpdateGroups()}
            baseSettings={renderBaseWidgetSettings("label")}
            onPatch={(patch) => {
              const id = configWidgetId();
              if (!id) return;
              updateWidgetConfig(id, patch);
            }}
          />
        ) : activeWidget()?.type === "sparklineChart" ? (
          <SparklineSettingsForm
            config={
              activeSparklineWidget()?.config ?? {
                label: "Latency",
                align: "left",
                min: 0,
                max: 100,
                format: "compact",
                decimals: 1,
                defaultValue: "",
                seriesLabelField: "label",
                seriesValueField: "value",
                strokeWidth: 2.5,
                showFill: true,
                updateGroup: "",
                apiEndpoint: "",
                field: ""
              }
            }
            dashboardUpdateGroups={dashboardUpdateGroups()}
            baseSettings={renderBaseWidgetSettings("label")}
            onPatch={(patch) => {
              const id = configWidgetId();
              if (!id) return;
              updateWidgetConfig(id, patch);
            }}
          />
        ) : activeWidget()?.type === "timeSeriesChart" ? (
          <TimeSeriesSettingsForm
            config={
              activeTimeSeriesWidget()?.config ?? {
                label: "Requests / min",
                align: "left",
                min: 0,
                max: 12,
                format: "compact",
                decimals: 1,
                defaultValue: "",
                seriesLabelField: "t",
                seriesValueField: "a",
                seriesValueFields: "a, b",
                strokeWidth: 2.2,
                showFill: true,
                showGrid: true,
                stacked: false,
                updateGroup: "",
                apiEndpoint: "",
                field: ""
              }
            }
            dashboardUpdateGroups={dashboardUpdateGroups()}
            baseSettings={renderBaseWidgetSettings("label")}
            onPatch={(patch) => {
              const id = configWidgetId();
              if (!id) return;
              updateWidgetConfig(id, patch);
            }}
          />
        ) : activeWidget()?.type === "mapNetwork" ? (
          <MapSettingsForm
            config={
              activeMapWidget()?.config ?? {
                label: "Map",
                align: "left",
                mapRegion: "world",
                min: 0,
                max: 1000,
                dotRadiusMin: 2.2,
                dotRadiusMax: 9.5,
                format: "compact",
                decimals: 0,
                lineBend: 0.14,
                defaultValue: "",
                updateGroup: "",
                apiEndpoint: "",
                field: ""
              }
            }
            dashboardUpdateGroups={dashboardUpdateGroups()}
            baseSettings={renderBaseWidgetSettings("label")}
            onPatch={(patch) => {
              const id = configWidgetId();
              if (!id) return;
              updateWidgetConfig(id, patch);
            }}
          />
        ) : (
          <BarSettingsForm
            config={
              activeBarWidget()?.config ?? {
                label: "Throughput",
                align: "left",
                orientation: "horizontal",
                min: 0,
                max: 100,
                format: "compact",
                decimals: 1,
                defaultValue: "",
                seriesLabelField: "label",
                seriesValueField: "value",
                updateGroup: "",
                apiEndpoint: "",
                field: ""
              }
            }
            dashboardUpdateGroups={dashboardUpdateGroups()}
            baseSettings={renderBaseWidgetSettings("label")}
            onPatch={(patch) => {
              const id = configWidgetId();
              if (!id) return;
              updateWidgetConfig(id, patch);
            }}
          />
        )}
      </WidgetConfigOverlayShell>
          </>
            </DashboardModule>
          </Show>
        </main>
      </div>

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
    </div>
  );
}

export default App;
