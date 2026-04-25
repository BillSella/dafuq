import { clamp } from "./widgets/baseWidget";
import {
  DEFAULT_WIDGET_TYPE,
  type WidgetConfigMap,
  type WidgetType,
  widgetRegistry
} from "./widgets/widgetRegistry";
import type { GaugeConfig } from "./widgets/gaugeWidget";
import type { DonutConfig } from "./widgets/donutWidget";
import type { BarConfig } from "./widgets/barWidget";
import type { SparklineConfig } from "./widgets/sparklineWidget";
import type { TimeSeriesConfig } from "./widgets/timeSeriesWidget";

/**
 * Dashboard document model and pure update utilities.
 *
 * State modification contract:
 * - Source of truth: caller-owned `DashboardDoc[]` collections.
 * - Mutation style: all update helpers are immutable transforms that return
 *   new dashboard arrays/documents.
 * - Guard behavior: placement/display helpers provide safe fallbacks when
 *   requested breakpoint data is missing.
 */

export type DashboardBreakpoint =
  | "mobilePortrait"
  | "mobileLandscape"
  | "tabletPortrait"
  | "tabletLandscape"
  | "laptopWxga"
  | "desktopFhd"
  | "qhd2k"
  | "uhd4k"
  | "uhd8k";

export type WidgetPlacement = {
  breakpoint: DashboardBreakpoint;
  colStart: number;
  rowStart: number;
  colSpan: number;
  rowSpan: number;
  visible: boolean;
};

export type WidgetDisplayConfig = {
  breakpoint: DashboardBreakpoint;
  label?: GaugeConfig["label"];
  fontSize?: GaugeConfig["fontSize"];
  align?: GaugeConfig["align"];
  ringWidth?: DonutConfig["ringWidth"];
  format?: GaugeConfig["format"];
  decimalPlaces?: GaugeConfig["decimalPlaces"];
  min?: DonutConfig["min"];
  max?: DonutConfig["max"];
  decimals?: DonutConfig["decimals"];
  orientation?: BarConfig["orientation"];
  seriesLabelField?: BarConfig["seriesLabelField"];
  seriesValueField?: BarConfig["seriesValueField"];
  seriesValueFields?: string;
  strokeWidth?: SparklineConfig["strokeWidth"];
  showFill?: SparklineConfig["showFill"];
  showGrid?: TimeSeriesConfig["showGrid"];
  stacked?: TimeSeriesConfig["stacked"];
};

export type DashboardWidgetDoc = {
  id: string;
  type: WidgetType;
  config: WidgetConfigMap[WidgetType];
  placements: WidgetPlacement[];
  display: WidgetDisplayConfig[];
};

export type DashboardDoc = {
  id: string;
  name: string;
  updateFrequencySeconds: number;
  enabledBreakpoints: Record<DashboardBreakpoint, boolean>;
  extraGridRows: Record<DashboardBreakpoint, number>;
  widgets: DashboardWidgetDoc[];
};

export const DASHBOARD_INDEX_STORAGE_KEY = "dashboard:index";
export const UPDATE_FREQUENCY_OPTIONS = [1, 5, 15, 60, 180, 300, 900] as const;

export type WidgetPatch = Partial<
  Pick<{ colStart: number; rowStart: number; colSpan: number; rowSpan: number }, "colStart" | "rowStart" | "colSpan" | "rowSpan">
>;

/**
 * Returns the localStorage key used for an individual dashboard document.
 */
export function makeDashboardStorageKey(id: string): string {
  return `dashboard:${id}.json`;
}

export function createDashboardDoc(
  name: string,
  includeDefaultWidget: boolean,
  breakpointIds: DashboardBreakpoint[]
): DashboardDoc {
  const id = `dashboard-${crypto.randomUUID()}`;
  const baseWidget = widgetRegistry[DEFAULT_WIDGET_TYPE].createState(
    `widget-${crypto.randomUUID()}`,
    2,
    2
  );
  return {
    id,
    name,
    updateFrequencySeconds: 60,
    enabledBreakpoints: Object.fromEntries(
      breakpointIds.map((breakpoint) => [breakpoint, true])
    ) as Record<DashboardBreakpoint, boolean>,
    extraGridRows: Object.fromEntries(
      breakpointIds.map((breakpoint) => [breakpoint, 0])
    ) as Record<DashboardBreakpoint, number>,
    widgets: includeDefaultWidget
      ? [
          {
            id: baseWidget.id,
            type: "numberGauge",
            config: baseWidget.config,
            placements: breakpointIds.map((breakpoint) => ({
              breakpoint,
              colStart: baseWidget.colStart,
              rowStart: baseWidget.rowStart,
              colSpan: baseWidget.colSpan,
              rowSpan: baseWidget.rowSpan,
              visible: true
            })),
            display: breakpointIds.map((breakpoint) => ({
              breakpoint,
              ...widgetRegistry[baseWidget.type].getDisplayConfigFromConfig(baseWidget.config)
            }))
          }
        ]
      : []
  };
}

const LEGACY_BREAKPOINT_ALIASES: Record<string, DashboardBreakpoint> = {
  phonePortrait: "mobilePortrait",
  phoneLandscape: "mobileLandscape",
  desktop: "desktopFhd",
  largeDesktop: "qhd2k",
  "4k": "uhd4k"
};
const CURRENT_BREAKPOINT_IDS: DashboardBreakpoint[] = [
  "mobilePortrait",
  "mobileLandscape",
  "tabletPortrait",
  "tabletLandscape",
  "laptopWxga",
  "desktopFhd",
  "qhd2k",
  "uhd4k",
  "uhd8k"
];

function coerceBreakpointId(raw: string): DashboardBreakpoint | null {
  if (CURRENT_BREAKPOINT_IDS.includes(raw as DashboardBreakpoint)) {
    return raw as DashboardBreakpoint;
  }
  return LEGACY_BREAKPOINT_ALIASES[raw] ?? null;
}

export function normalizeDashboardDoc(
  doc: DashboardDoc,
  breakpointIds: DashboardBreakpoint[]
): DashboardDoc {
  const migratedEnabledEntries = Object.entries(doc.enabledBreakpoints ?? {}).flatMap(([rawKey, value]) => {
    const isLegacyKey = rawKey in LEGACY_BREAKPOINT_ALIASES;
    if (isLegacyKey && value === false) {
      // Legacy defaults were mostly disabled except desktop; new model expects editable multi-breakpoint defaults.
      return [];
    }
    const mapped = coerceBreakpointId(rawKey);
    if (!mapped) return [];
    return [[mapped, Boolean(value)] as const];
  });
  const migratedEnabled = Object.fromEntries(migratedEnabledEntries) as Partial<
    Record<DashboardBreakpoint, boolean>
  >;
  const enabledBreakpoints = Object.fromEntries(
    breakpointIds.map((breakpoint) => {
      const existing = migratedEnabled[breakpoint];
      return [breakpoint, existing ?? true];
    })
  ) as Record<DashboardBreakpoint, boolean>;
  const migratedExtraRowsEntries = Object.entries((doc as DashboardDoc & { extraGridRows?: Record<string, unknown> }).extraGridRows ?? {}).flatMap(
    ([rawKey, value]) => {
      const mapped = coerceBreakpointId(rawKey);
      if (!mapped) return [];
      const numeric = typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
      return [[mapped, numeric] as const];
    }
  );
  const migratedExtraRows = Object.fromEntries(migratedExtraRowsEntries) as Partial<
    Record<DashboardBreakpoint, number>
  >;
  const extraGridRows = Object.fromEntries(
    breakpointIds.map((breakpoint) => [breakpoint, migratedExtraRows[breakpoint] ?? 0])
  ) as Record<DashboardBreakpoint, number>;
  return {
    ...doc,
    updateFrequencySeconds: clamp(
      doc.updateFrequencySeconds ?? 60,
      UPDATE_FREQUENCY_OPTIONS[0],
      UPDATE_FREQUENCY_OPTIONS[UPDATE_FREQUENCY_OPTIONS.length - 1]
    ),
    enabledBreakpoints,
    extraGridRows,
    widgets: doc.widgets.map((widget) => {
      const migratedPlacements = (widget.placements ?? [])
        .map((placement) => {
          const mapped = coerceBreakpointId(String(placement.breakpoint));
          if (!mapped) return null;
          return {
            ...placement,
            breakpoint: mapped,
            visible: placement.visible ?? true
          };
        })
        .filter((placement): placement is WidgetPlacement => !!placement);
      const placementByBreakpoint = new Map<DashboardBreakpoint, WidgetPlacement>();
      for (const placement of migratedPlacements) {
        if (!placementByBreakpoint.has(placement.breakpoint)) {
          placementByBreakpoint.set(placement.breakpoint, placement);
        }
      }
      const fallbackPlacement = migratedPlacements[0] ?? {
        breakpoint: breakpointIds[0]!,
        colStart: 1,
        rowStart: 1,
        colSpan: 16,
        rowSpan: 16,
        visible: true
      };
      const normalizedPlacements = breakpointIds.map((breakpoint) => ({
        ...(placementByBreakpoint.get(breakpoint) ?? fallbackPlacement),
        breakpoint
      }));

      const migratedDisplay = (widget.display ?? [])
        .map((entry) => {
          const mapped = coerceBreakpointId(String(entry.breakpoint));
          if (!mapped) return null;
          return { ...entry, breakpoint: mapped };
        })
        .filter((entry): entry is WidgetDisplayConfig => !!entry);
      const displayByBreakpoint = new Map<DashboardBreakpoint, WidgetDisplayConfig>();
      for (const entry of migratedDisplay) {
        if (!displayByBreakpoint.has(entry.breakpoint)) {
          displayByBreakpoint.set(entry.breakpoint, entry);
        }
      }
      const defaultDisplay = widgetRegistry[widget.type].getDisplayConfigFromConfig(widget.config);
      const normalizedDisplay = breakpointIds.map((breakpoint) => ({
        breakpoint,
        ...(displayByBreakpoint.get(breakpoint) ?? defaultDisplay)
      }));

      return {
        ...widget,
        placements: normalizedPlacements,
        display: normalizedDisplay
      };
    })
  };
}

/**
 * Reads a widget placement for a breakpoint with safe fallback defaults.
 */
export function getWidgetPlacement(
  widget: DashboardWidgetDoc,
  breakpoint: DashboardBreakpoint
): WidgetPlacement {
  const found =
    widget.placements.find((placement) => placement.breakpoint === breakpoint) ??
    widget.placements[0] ?? {
      breakpoint,
      colStart: 1,
      rowStart: 1,
      colSpan: 16,
      rowSpan: 16,
      visible: true
    };
  return {
    ...found,
    visible: found.visible ?? true
  };
}

/**
 * Inserts or replaces a widget placement for the specified breakpoint.
 */
export function upsertWidgetPlacement(
  widget: DashboardWidgetDoc,
  breakpoint: DashboardBreakpoint,
  nextPlacement: WidgetPlacement
): WidgetPlacement[] {
  const exists = widget.placements.some((placement) => placement.breakpoint === breakpoint);
  if (!exists) {
    return [...widget.placements, nextPlacement];
  }
  return widget.placements.map((placement) =>
    placement.breakpoint === breakpoint ? nextPlacement : placement
  );
}

/**
 * Reads display config for a breakpoint or falls back to registry defaults.
 */
export function getWidgetDisplayConfig(
  widget: DashboardWidgetDoc,
  breakpoint: DashboardBreakpoint
): Omit<WidgetDisplayConfig, "breakpoint"> {
  const found = widget.display.find((entry) => entry.breakpoint === breakpoint);
  if (found) {
    return {
      label: found.label,
      fontSize: found.fontSize,
      align: found.align,
      ringWidth: found.ringWidth,
      format: found.format,
      decimalPlaces: found.decimalPlaces,
      min: found.min,
      max: found.max,
      decimals: found.decimals,
      orientation: found.orientation,
      seriesLabelField: found.seriesLabelField,
      seriesValueField: found.seriesValueField,
      seriesValueFields: found.seriesValueFields,
      strokeWidth: found.strokeWidth,
      showFill: found.showFill,
      showGrid: found.showGrid,
      stacked: found.stacked
    };
  }
  return {
    ...widgetRegistry[widget.type].getDisplayConfigFromConfig(widget.config)
  };
}

/**
 * Inserts or replaces display config for the specified breakpoint.
 */
export function upsertWidgetDisplayConfig(
  widget: DashboardWidgetDoc,
  breakpoint: DashboardBreakpoint,
  nextDisplay: Omit<WidgetDisplayConfig, "breakpoint">
): WidgetDisplayConfig[] {
  const nextEntry: WidgetDisplayConfig = { breakpoint, ...nextDisplay };
  const exists = widget.display.some((entry) => entry.breakpoint === breakpoint);
  if (!exists) return [...widget.display, nextEntry];
  return widget.display.map((entry) => (entry.breakpoint === breakpoint ? nextEntry : entry));
}

export function updateWidgetInDashboards(
  dashboards: DashboardDoc[],
  dashboardId: string,
  breakpoint: DashboardBreakpoint,
  widgetId: string,
  patch: WidgetPatch
): DashboardDoc[] {
  return dashboards.map((dashboard) => {
    if (dashboard.id !== dashboardId) return dashboard;
    return {
      ...dashboard,
      widgets: dashboard.widgets.map((widget) => {
        if (widget.id !== widgetId) return widget;
        const placement = getWidgetPlacement(widget, breakpoint);
        const nextPlacement = { ...placement, ...patch };
        return {
          ...widget,
          placements: upsertWidgetPlacement(widget, breakpoint, {
            breakpoint,
            colStart: nextPlacement.colStart ?? placement.colStart,
            rowStart: nextPlacement.rowStart ?? placement.rowStart,
            colSpan: nextPlacement.colSpan ?? placement.colSpan,
            rowSpan: nextPlacement.rowSpan ?? placement.rowSpan,
            visible: placement.visible
          })
        };
      })
    };
  });
}

export function updateWidgetConfigInDashboards(
  dashboards: DashboardDoc[],
  dashboardId: string,
  breakpoint: DashboardBreakpoint,
  widgetId: string,
  patch: Partial<WidgetConfigMap[WidgetType]>
): DashboardDoc[] {
  return dashboards.map((dashboard) => {
    if (dashboard.id !== dashboardId) return dashboard;
    return {
      ...dashboard,
      widgets: dashboard.widgets.map((widget) => {
        if (widget.id !== widgetId) return widget;
        const { displayPatch, globalPatch } = widgetRegistry[widget.type].splitConfigPatch(
          patch as Partial<WidgetConfigMap[typeof widget.type]>
        );
        return {
          ...widget,
          config: Object.keys(globalPatch).length > 0 ? { ...widget.config, ...globalPatch } : widget.config,
          display:
            Object.keys(displayPatch).length > 0
              ? upsertWidgetDisplayConfig(widget, breakpoint, {
                  ...getWidgetDisplayConfig(widget, breakpoint),
                  ...displayPatch
                })
              : widget.display
        };
      })
    };
  });
}

export function updateWidgetVisibilityInDashboards(
  dashboards: DashboardDoc[],
  dashboardId: string,
  widgetId: string,
  breakpoint: DashboardBreakpoint,
  visible: boolean
): DashboardDoc[] {
  return dashboards.map((dashboard) => {
    if (dashboard.id !== dashboardId) return dashboard;
    return {
      ...dashboard,
      widgets: dashboard.widgets.map((widget) => {
        if (widget.id !== widgetId) return widget;
        const placement = getWidgetPlacement(widget, breakpoint);
        return {
          ...widget,
          placements: upsertWidgetPlacement(widget, breakpoint, {
            ...placement,
            breakpoint,
            visible
          })
        };
      })
    };
  });
}

export function deleteWidgetInDashboards(
  dashboards: DashboardDoc[],
  dashboardId: string,
  widgetId: string
): DashboardDoc[] {
  return dashboards.map((dashboard) =>
    dashboard.id === dashboardId
      ? { ...dashboard, widgets: dashboard.widgets.filter((widget) => widget.id !== widgetId) }
      : dashboard
  );
}

export function ensureWidgetsFitGridInDashboards(
  dashboards: DashboardDoc[],
  dashboardId: string,
  breakpoint: DashboardBreakpoint,
  nextColumns: number,
  nextRows: number,
  minSpan: number
): DashboardDoc[] {
  return dashboards.map((dashboard) => {
    if (dashboard.id !== dashboardId) return dashboard;
    return {
      ...dashboard,
      widgets: dashboard.widgets.map((widget) => {
        const placement = getWidgetPlacement(widget, breakpoint);
        const clamped = widgetRegistry[widget.type].clampToGrid(
          {
            id: widget.id,
            type: widget.type,
            colStart: placement.colStart,
            rowStart: placement.rowStart,
            colSpan: placement.colSpan,
            rowSpan: placement.rowSpan,
            config: widget.config
          },
          nextColumns,
          nextRows,
          minSpan
        );
        return {
          ...widget,
          placements: upsertWidgetPlacement(widget, breakpoint, {
            breakpoint,
            colStart: clamp(clamped.colStart, 1, nextColumns),
            rowStart: clamp(clamped.rowStart, 1, nextRows),
            colSpan: clamped.colSpan,
            rowSpan: clamped.rowSpan,
            visible: placement.visible
          })
        };
      })
    };
  });
}
