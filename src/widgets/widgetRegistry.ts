import { GaugeWidget, type GaugeConfig } from "./gaugeWidget";
import { LabelWidget, type LabelConfig } from "./labelWidget";
import { DonutWidget, type DonutConfig } from "./donutWidget";
import { BarWidget, type BarConfig } from "./barWidget";
import { SparklineWidget, type SparklineConfig } from "./sparklineWidget";
import { TimeSeriesWidget, type TimeSeriesConfig } from "./timeSeriesWidget";
import { MapWidget, type MapConfig } from "./mapWidget";
import type { WidgetState } from "./baseWidget";

/**
 * Widget registry mapping each widget type to normalized behavior adapters.
 *
 * State modification contract:
 * - Source of truth: callers provide widget state/config inputs.
 * - Mutation paths: `splitConfigPatch` partitions display vs global updates for
 *   parent-owned dashboard state mutation flows.
 * - Guard behavior: `getFetchSpec` and `getUpdateGroup` normalize missing config
 *   values into safe defaults for orchestration layers.
 */

export type WidgetType =
  | "numberGauge"
  | "label"
  | "donutChart"
  | "barChart"
  | "sparklineChart"
  | "timeSeriesChart"
  | "mapNetwork";

export type WidgetConfigMap = {
  numberGauge: GaugeConfig;
  label: LabelConfig;
  donutChart: DonutConfig;
  barChart: BarConfig;
  sparklineChart: SparklineConfig;
  timeSeriesChart: TimeSeriesConfig;
  mapNetwork: MapConfig;
};
export type CommonWidgetSettingsPatch = {
  label?: string;
  staticText?: string;
  align?: GaugeConfig["align"];
  fontSize?: GaugeConfig["fontSize"];
};
export type WidgetLibraryItem<TType extends WidgetType = WidgetType> = {
  id: TType;
  label: string;
  shortLabel: string;
  category: "Data";
};

export type WidgetStateByType<TType extends WidgetType = WidgetType> = WidgetState<
  TType,
  WidgetConfigMap[TType]
>;
export type GaugeDisplayConfig = Pick<
  GaugeConfig,
  "label" | "fontSize" | "align" | "format" | "decimalPlaces"
>;
export type GaugeGlobalConfigPatch = Partial<
  Pick<GaugeConfig, "apiEndpoint" | "field" | "defaultValue" | "updateGroup">
>;
export type GaugeDisplayConfigPatch = Partial<GaugeDisplayConfig>;
export type LabelDisplayConfig = Pick<LabelConfig, "align"> & { fontSize?: GaugeConfig["fontSize"] };
export type LabelDisplayConfigPatch = Partial<LabelDisplayConfig>;
export type LabelGlobalConfigPatch = Partial<Omit<LabelConfig, "align">>;
export type DonutDisplayConfig = Pick<
  DonutConfig,
  "label" | "align" | "ringWidth" | "min" | "max" | "decimals" | "format" | "seriesLabelField" | "seriesValueField"
> & { fontSize?: GaugeConfig["fontSize"] };
export type DonutDisplayConfigPatch = Partial<DonutDisplayConfig>;
export type DonutGlobalConfigPatch = Partial<
  Pick<DonutConfig, "apiEndpoint" | "field" | "defaultValue" | "updateGroup">
>;
export type BarDisplayConfig = Pick<
  BarConfig,
  "label" | "align" | "orientation" | "min" | "max" | "format" | "decimals" | "seriesLabelField" | "seriesValueField"
> & { fontSize?: GaugeConfig["fontSize"] };
export type BarDisplayConfigPatch = Partial<BarDisplayConfig>;
export type BarGlobalConfigPatch = Partial<
  Pick<BarConfig, "apiEndpoint" | "field" | "defaultValue" | "updateGroup">
>;
export type SparklineDisplayConfig = Pick<
  SparklineConfig,
  | "label"
  | "align"
  | "min"
  | "max"
  | "format"
  | "decimals"
  | "seriesLabelField"
  | "seriesValueField"
  | "strokeWidth"
  | "showFill"
> & { fontSize?: GaugeConfig["fontSize"] };
export type SparklineDisplayConfigPatch = Partial<SparklineDisplayConfig>;
export type SparklineGlobalConfigPatch = Partial<
  Pick<SparklineConfig, "apiEndpoint" | "field" | "defaultValue" | "updateGroup">
>;
export type TimeSeriesDisplayConfig = Pick<
  TimeSeriesConfig,
  | "label"
  | "align"
  | "min"
  | "max"
  | "format"
  | "decimals"
  | "seriesLabelField"
  | "seriesValueField"
  | "seriesValueFields"
  | "strokeWidth"
  | "showFill"
  | "showGrid"
  | "stacked"
> & { fontSize?: GaugeConfig["fontSize"] };
export type TimeSeriesDisplayConfigPatch = Partial<TimeSeriesDisplayConfig>;
export type TimeSeriesGlobalConfigPatch = Partial<
  Pick<TimeSeriesConfig, "apiEndpoint" | "field" | "defaultValue" | "updateGroup">
>;
export type MapDisplayConfig = Pick<
  MapConfig,
  | "label"
  | "align"
  | "mapRegion"
  | "min"
  | "max"
  | "dotRadiusMin"
  | "dotRadiusMax"
  | "format"
  | "decimals"
  | "lineBend"
> & { fontSize?: GaugeConfig["fontSize"] };
export type MapDisplayConfigPatch = Partial<MapDisplayConfig>;
export type MapGlobalConfigPatch = Partial<
  Pick<MapConfig, "apiEndpoint" | "field" | "defaultValue" | "updateGroup">
>;
export type WidgetFetchSpec = {
  enabled: boolean;
  endpoint: string;
  field: string;
  fallback: string;
};
type RegistryEntry = {
  createState: (id: string, colStart: number, rowStart: number) => WidgetStateByType;
  getDisplayValue: (widget: WidgetStateByType | unknown) => string;
  getDisplayValueWithRuntime: (widget: WidgetStateByType | unknown, runtimeValue?: string) => string;
  clampToGrid: (
    widget: WidgetStateByType | unknown,
    columns: number,
    rows: number,
    minSpan: number
  ) => WidgetStateByType;
  normalizeConfig: (widget: WidgetStateByType | unknown) => WidgetConfigMap[WidgetType];
  getDisplayConfigFromConfig: (config: WidgetConfigMap[WidgetType]) => object;
  splitConfigPatch: (patch: Partial<WidgetConfigMap[WidgetType]>) => {
    displayPatch: object;
    globalPatch: object;
  };
  getFetchSpec: (config: WidgetConfigMap[WidgetType]) => WidgetFetchSpec;
  getUpdateGroup: (config: WidgetConfigMap[WidgetType]) => string;
};

const DEFAULT_WIDGET_TYPE: WidgetType = "numberGauge";

function asGaugeState(widget: WidgetStateByType<"numberGauge"> | unknown): WidgetStateByType<"numberGauge"> {
  return widget as WidgetStateByType<"numberGauge">;
}
function asLabelState(widget: WidgetStateByType<"label"> | unknown): WidgetStateByType<"label"> {
  return widget as WidgetStateByType<"label">;
}
function asDonutState(
  widget: WidgetStateByType<"donutChart"> | unknown
): WidgetStateByType<"donutChart"> {
  return widget as WidgetStateByType<"donutChart">;
}
function asBarState(widget: WidgetStateByType<"barChart"> | unknown): WidgetStateByType<"barChart"> {
  return widget as WidgetStateByType<"barChart">;
}
function asSparklineState(
  widget: WidgetStateByType<"sparklineChart"> | unknown
): WidgetStateByType<"sparklineChart"> {
  return widget as WidgetStateByType<"sparklineChart">;
}
function asTimeSeriesState(
  widget: WidgetStateByType<"timeSeriesChart"> | unknown
): WidgetStateByType<"timeSeriesChart"> {
  return widget as WidgetStateByType<"timeSeriesChart">;
}
function asMapState(
  widget: WidgetStateByType<"mapNetwork"> | unknown
): WidgetStateByType<"mapNetwork"> {
  return widget as WidgetStateByType<"mapNetwork">;
}

export const widgetRegistry: Record<WidgetType, RegistryEntry> = {
  numberGauge: {
    createState(id: string, colStart: number, rowStart: number): WidgetStateByType<"numberGauge"> {
      return GaugeWidget.create(id, colStart, rowStart).toState();
    },
    getDisplayValue(widget: WidgetStateByType | unknown): string {
      return new GaugeWidget(asGaugeState(widget)).getDisplayValue();
    },
    getDisplayValueWithRuntime(
      widget: WidgetStateByType | unknown,
      runtimeValue?: string
    ): string {
      const gauge = asGaugeState(widget);
      return new GaugeWidget({
        ...gauge,
        config: {
          ...gauge.config,
          defaultValue: runtimeValue ?? gauge.config.defaultValue
        }
      }).getDisplayValue();
    },
    clampToGrid(
      widget: WidgetStateByType | unknown,
      columns: number,
      rows: number,
      minSpan: number
    ): WidgetStateByType<"numberGauge"> {
      return new GaugeWidget(asGaugeState(widget))
        .clampToGrid(columns, rows, minSpan)
        .toState();
    },
    normalizeConfig(widget: WidgetStateByType | unknown): GaugeConfig {
      return new GaugeWidget(asGaugeState(widget)).toState().config;
    },
    getDisplayConfigFromConfig(config: WidgetConfigMap[WidgetType]): GaugeDisplayConfig {
      const typed = config as GaugeConfig;
      return {
        label: typed.label,
        fontSize: typed.fontSize,
        align: typed.align,
        format: typed.format,
        decimalPlaces: typed.decimalPlaces
      };
    },
    splitConfigPatch(patch: Partial<WidgetConfigMap[WidgetType]>): {
      displayPatch: GaugeDisplayConfigPatch;
      globalPatch: GaugeGlobalConfigPatch;
    } {
      const typed = patch as Partial<GaugeConfig>;
      const displayPatch: GaugeDisplayConfigPatch = {};
      const globalPatch: GaugeGlobalConfigPatch = {};
      if (typed.label !== undefined) displayPatch.label = typed.label;
      if (typed.fontSize !== undefined) displayPatch.fontSize = typed.fontSize;
      if (typed.align !== undefined) displayPatch.align = typed.align;
      if (typed.format !== undefined) displayPatch.format = typed.format;
      if (typed.decimalPlaces !== undefined) displayPatch.decimalPlaces = typed.decimalPlaces;
      if (typed.apiEndpoint !== undefined) globalPatch.apiEndpoint = typed.apiEndpoint;
      if (typed.field !== undefined) globalPatch.field = typed.field;
      if (typed.defaultValue !== undefined) globalPatch.defaultValue = typed.defaultValue;
      if (typed.updateGroup !== undefined) globalPatch.updateGroup = typed.updateGroup;
      return { displayPatch, globalPatch };
    },
    getFetchSpec(config: WidgetConfigMap[WidgetType]): WidgetFetchSpec {
      const typed = config as GaugeConfig;
      return {
        enabled: !!typed.apiEndpoint,
        endpoint: typed.apiEndpoint,
        field: typed.field,
        fallback: typed.defaultValue
      };
    },
    getUpdateGroup(config: WidgetConfigMap[WidgetType]): string {
      return (config as GaugeConfig).updateGroup?.trim() ?? "";
    }
  },
  label: {
    createState(id: string, colStart: number, rowStart: number): WidgetStateByType<"label"> {
      return LabelWidget.create(id, colStart, rowStart).toState();
    },
    getDisplayValue(widget: WidgetStateByType | unknown): string {
      return new LabelWidget(asLabelState(widget)).getDisplayValue();
    },
    getDisplayValueWithRuntime(
      widget: WidgetStateByType | unknown,
      runtimeValue?: string
    ): string {
      const label = asLabelState(widget);
      if (label.config.sourceMode === "static") return label.config.staticText;
      return runtimeValue ?? label.config.fallbackText;
    },
    clampToGrid(
      widget: WidgetStateByType | unknown,
      columns: number,
      rows: number,
      minSpan: number
    ): WidgetStateByType<"label"> {
      return new LabelWidget(asLabelState(widget))
        .clampToGrid(columns, rows, minSpan)
        .toState();
    },
    normalizeConfig(widget: WidgetStateByType | unknown): LabelConfig {
      return new LabelWidget(asLabelState(widget)).toState().config;
    },
    getDisplayConfigFromConfig(config: WidgetConfigMap[WidgetType]): LabelDisplayConfig {
      const typed = config as LabelConfig;
      return {
        align: typed.align,
        fontSize: (typed as LabelConfig & { fontSize?: GaugeConfig["fontSize"] }).fontSize ?? "medium"
      };
    },
    splitConfigPatch(patch: Partial<WidgetConfigMap[WidgetType]>): {
      displayPatch: LabelDisplayConfigPatch;
      globalPatch: LabelGlobalConfigPatch;
    } {
      const typed = patch as Partial<LabelConfig>;
      const displayPatch: LabelDisplayConfigPatch = {};
      const globalPatch: LabelGlobalConfigPatch = {};
      const typedWithCommon = typed as Partial<LabelConfig> & {
        fontSize?: GaugeConfig["fontSize"];
      };
      if (typed.align !== undefined) displayPatch.align = typed.align;
      if (typedWithCommon.fontSize !== undefined) displayPatch.fontSize = typedWithCommon.fontSize;
      if (typed.sourceMode !== undefined) globalPatch.sourceMode = typed.sourceMode;
      if (typed.staticText !== undefined) globalPatch.staticText = typed.staticText;
      if (typed.apiEndpoint !== undefined) globalPatch.apiEndpoint = typed.apiEndpoint;
      if (typed.field !== undefined) globalPatch.field = typed.field;
      if (typed.fallbackText !== undefined) globalPatch.fallbackText = typed.fallbackText;
      if (typed.updateGroup !== undefined) globalPatch.updateGroup = typed.updateGroup;
      return { displayPatch, globalPatch };
    },
    getFetchSpec(config: WidgetConfigMap[WidgetType]): WidgetFetchSpec {
      const typed = config as LabelConfig;
      return {
        enabled: typed.sourceMode === "api" && !!typed.apiEndpoint,
        endpoint: typed.apiEndpoint,
        field: typed.field,
        fallback: typed.fallbackText
      };
    },
    getUpdateGroup(config: WidgetConfigMap[WidgetType]): string {
      return (config as LabelConfig).updateGroup?.trim() ?? "";
    }
  },
  donutChart: {
    createState(id: string, colStart: number, rowStart: number): WidgetStateByType<"donutChart"> {
      return DonutWidget.create(id, colStart, rowStart).toState();
    },
    getDisplayValue(widget: WidgetStateByType | unknown): string {
      return new DonutWidget(asDonutState(widget)).getDisplayValue();
    },
    getDisplayValueWithRuntime(
      widget: WidgetStateByType | unknown,
      runtimeValue?: string
    ): string {
      const donut = asDonutState(widget);
      return new DonutWidget({
        ...donut,
        config: {
          ...donut.config,
          defaultValue: runtimeValue ?? donut.config.defaultValue
        }
      }).getDisplayValue();
    },
    clampToGrid(
      widget: WidgetStateByType | unknown,
      columns: number,
      rows: number,
      minSpan: number
    ): WidgetStateByType<"donutChart"> {
      return new DonutWidget(asDonutState(widget))
        .clampToGrid(columns, rows, minSpan)
        .toState();
    },
    normalizeConfig(widget: WidgetStateByType | unknown): DonutConfig {
      return new DonutWidget(asDonutState(widget)).toState().config;
    },
    getDisplayConfigFromConfig(config: WidgetConfigMap[WidgetType]): DonutDisplayConfig {
      const typed = config as DonutConfig;
      return {
        label: typed.label,
        align: typed.align,
        fontSize: (typed as DonutConfig & { fontSize?: GaugeConfig["fontSize"] }).fontSize ?? "medium",
        ringWidth: typed.ringWidth,
        min: typed.min,
        max: typed.max,
        decimals: typed.decimals,
        format: typed.format,
        seriesLabelField: typed.seriesLabelField,
        seriesValueField: typed.seriesValueField
      };
    },
    splitConfigPatch(patch: Partial<WidgetConfigMap[WidgetType]>): {
      displayPatch: DonutDisplayConfigPatch;
      globalPatch: DonutGlobalConfigPatch;
    } {
      const typed = patch as Partial<DonutConfig>;
      const displayPatch: DonutDisplayConfigPatch = {};
      const globalPatch: DonutGlobalConfigPatch = {};
      const typedWithCommon = typed as Partial<DonutConfig> & {
        fontSize?: GaugeConfig["fontSize"];
      };
      if (typed.label !== undefined) displayPatch.label = typed.label;
      if (typed.align !== undefined) displayPatch.align = typed.align;
      if (typedWithCommon.fontSize !== undefined) displayPatch.fontSize = typedWithCommon.fontSize;
      if (typed.ringWidth !== undefined) displayPatch.ringWidth = typed.ringWidth;
      if (typed.min !== undefined) displayPatch.min = typed.min;
      if (typed.max !== undefined) displayPatch.max = typed.max;
      if (typed.decimals !== undefined) displayPatch.decimals = typed.decimals;
      if (typed.format !== undefined) displayPatch.format = typed.format;
      if (typed.seriesLabelField !== undefined) displayPatch.seriesLabelField = typed.seriesLabelField;
      if (typed.seriesValueField !== undefined) displayPatch.seriesValueField = typed.seriesValueField;
      if (typed.apiEndpoint !== undefined) globalPatch.apiEndpoint = typed.apiEndpoint;
      if (typed.field !== undefined) globalPatch.field = typed.field;
      if (typed.defaultValue !== undefined) globalPatch.defaultValue = typed.defaultValue;
      if (typed.updateGroup !== undefined) globalPatch.updateGroup = typed.updateGroup;
      return { displayPatch, globalPatch };
    },
    getFetchSpec(config: WidgetConfigMap[WidgetType]): WidgetFetchSpec {
      const typed = config as DonutConfig;
      return {
        enabled: !!typed.apiEndpoint,
        endpoint: typed.apiEndpoint,
        field: typed.field,
        fallback: typed.defaultValue
      };
    },
    getUpdateGroup(config: WidgetConfigMap[WidgetType]): string {
      return (config as DonutConfig).updateGroup?.trim() ?? "";
    }
  },
  barChart: {
    createState(id: string, colStart: number, rowStart: number): WidgetStateByType<"barChart"> {
      return BarWidget.create(id, colStart, rowStart).toState();
    },
    getDisplayValue(widget: WidgetStateByType | unknown): string {
      return new BarWidget(asBarState(widget)).getDisplayValue();
    },
    getDisplayValueWithRuntime(
      widget: WidgetStateByType | unknown,
      runtimeValue?: string
    ): string {
      const bar = asBarState(widget);
      return new BarWidget({
        ...bar,
        config: {
          ...bar.config,
          defaultValue: runtimeValue ?? bar.config.defaultValue
        }
      }).getDisplayValue();
    },
    clampToGrid(
      widget: WidgetStateByType | unknown,
      columns: number,
      rows: number,
      minSpan: number
    ): WidgetStateByType<"barChart"> {
      return new BarWidget(asBarState(widget))
        .clampToGrid(columns, rows, minSpan)
        .toState();
    },
    normalizeConfig(widget: WidgetStateByType | unknown): BarConfig {
      return new BarWidget(asBarState(widget)).toState().config;
    },
    getDisplayConfigFromConfig(config: WidgetConfigMap[WidgetType]): BarDisplayConfig {
      const typed = config as BarConfig;
      return {
        label: typed.label,
        align: typed.align,
        fontSize: (typed as BarConfig & { fontSize?: GaugeConfig["fontSize"] }).fontSize ?? "medium",
        orientation: typed.orientation,
        min: typed.min,
        max: typed.max,
        format: typed.format,
        decimals: typed.decimals,
        seriesLabelField: typed.seriesLabelField,
        seriesValueField: typed.seriesValueField
      };
    },
    splitConfigPatch(patch: Partial<WidgetConfigMap[WidgetType]>): {
      displayPatch: BarDisplayConfigPatch;
      globalPatch: BarGlobalConfigPatch;
    } {
      const typed = patch as Partial<BarConfig>;
      const displayPatch: BarDisplayConfigPatch = {};
      const globalPatch: BarGlobalConfigPatch = {};
      const typedWithCommon = typed as Partial<BarConfig> & {
        fontSize?: GaugeConfig["fontSize"];
      };
      if (typed.label !== undefined) displayPatch.label = typed.label;
      if (typed.align !== undefined) displayPatch.align = typed.align;
      if (typedWithCommon.fontSize !== undefined) displayPatch.fontSize = typedWithCommon.fontSize;
      if (typed.orientation !== undefined) displayPatch.orientation = typed.orientation;
      if (typed.min !== undefined) displayPatch.min = typed.min;
      if (typed.max !== undefined) displayPatch.max = typed.max;
      if (typed.format !== undefined) displayPatch.format = typed.format;
      if (typed.decimals !== undefined) displayPatch.decimals = typed.decimals;
      if (typed.seriesLabelField !== undefined) displayPatch.seriesLabelField = typed.seriesLabelField;
      if (typed.seriesValueField !== undefined) displayPatch.seriesValueField = typed.seriesValueField;
      if (typed.apiEndpoint !== undefined) globalPatch.apiEndpoint = typed.apiEndpoint;
      if (typed.field !== undefined) globalPatch.field = typed.field;
      if (typed.defaultValue !== undefined) globalPatch.defaultValue = typed.defaultValue;
      if (typed.updateGroup !== undefined) globalPatch.updateGroup = typed.updateGroup;
      return { displayPatch, globalPatch };
    },
    getFetchSpec(config: WidgetConfigMap[WidgetType]): WidgetFetchSpec {
      const typed = config as BarConfig;
      return {
        enabled: !!typed.apiEndpoint,
        endpoint: typed.apiEndpoint,
        field: typed.field,
        fallback: typed.defaultValue
      };
    },
    getUpdateGroup(config: WidgetConfigMap[WidgetType]): string {
      return (config as BarConfig).updateGroup?.trim() ?? "";
    }
  },
  sparklineChart: {
    createState(id: string, colStart: number, rowStart: number): WidgetStateByType<"sparklineChart"> {
      return SparklineWidget.create(id, colStart, rowStart).toState();
    },
    getDisplayValue(widget: WidgetStateByType | unknown): string {
      return new SparklineWidget(asSparklineState(widget)).getDisplayValue();
    },
    getDisplayValueWithRuntime(
      widget: WidgetStateByType | unknown,
      runtimeValue?: string
    ): string {
      const spark = asSparklineState(widget);
      return new SparklineWidget({
        ...spark,
        config: {
          ...spark.config,
          defaultValue: runtimeValue ?? spark.config.defaultValue
        }
      }).getDisplayValue();
    },
    clampToGrid(
      widget: WidgetStateByType | unknown,
      columns: number,
      rows: number,
      minSpan: number
    ): WidgetStateByType<"sparklineChart"> {
      return new SparklineWidget(asSparklineState(widget))
        .clampToGrid(columns, rows, minSpan)
        .toState();
    },
    normalizeConfig(widget: WidgetStateByType | unknown): SparklineConfig {
      return new SparklineWidget(asSparklineState(widget)).toState().config;
    },
    getDisplayConfigFromConfig(config: WidgetConfigMap[WidgetType]): SparklineDisplayConfig {
      const typed = config as SparklineConfig;
      return {
        label: typed.label,
        align: typed.align,
        fontSize:
          (typed as SparklineConfig & { fontSize?: GaugeConfig["fontSize"] }).fontSize ?? "medium",
        min: typed.min,
        max: typed.max,
        format: typed.format,
        decimals: typed.decimals,
        seriesLabelField: typed.seriesLabelField,
        seriesValueField: typed.seriesValueField,
        strokeWidth: typed.strokeWidth,
        showFill: typed.showFill
      };
    },
    splitConfigPatch(patch: Partial<WidgetConfigMap[WidgetType]>): {
      displayPatch: SparklineDisplayConfigPatch;
      globalPatch: SparklineGlobalConfigPatch;
    } {
      const typed = patch as Partial<SparklineConfig>;
      const displayPatch: SparklineDisplayConfigPatch = {};
      const globalPatch: SparklineGlobalConfigPatch = {};
      const typedWithCommon = typed as Partial<SparklineConfig> & {
        fontSize?: GaugeConfig["fontSize"];
      };
      if (typed.label !== undefined) displayPatch.label = typed.label;
      if (typed.align !== undefined) displayPatch.align = typed.align;
      if (typedWithCommon.fontSize !== undefined) displayPatch.fontSize = typedWithCommon.fontSize;
      if (typed.min !== undefined) displayPatch.min = typed.min;
      if (typed.max !== undefined) displayPatch.max = typed.max;
      if (typed.format !== undefined) displayPatch.format = typed.format;
      if (typed.decimals !== undefined) displayPatch.decimals = typed.decimals;
      if (typed.seriesLabelField !== undefined) displayPatch.seriesLabelField = typed.seriesLabelField;
      if (typed.seriesValueField !== undefined) displayPatch.seriesValueField = typed.seriesValueField;
      if (typed.strokeWidth !== undefined) displayPatch.strokeWidth = typed.strokeWidth;
      if (typed.showFill !== undefined) displayPatch.showFill = typed.showFill;
      if (typed.apiEndpoint !== undefined) globalPatch.apiEndpoint = typed.apiEndpoint;
      if (typed.field !== undefined) globalPatch.field = typed.field;
      if (typed.defaultValue !== undefined) globalPatch.defaultValue = typed.defaultValue;
      if (typed.updateGroup !== undefined) globalPatch.updateGroup = typed.updateGroup;
      return { displayPatch, globalPatch };
    },
    getFetchSpec(config: WidgetConfigMap[WidgetType]): WidgetFetchSpec {
      const typed = config as SparklineConfig;
      return {
        enabled: !!typed.apiEndpoint,
        endpoint: typed.apiEndpoint,
        field: typed.field,
        fallback: typed.defaultValue
      };
    },
    getUpdateGroup(config: WidgetConfigMap[WidgetType]): string {
      return (config as SparklineConfig).updateGroup?.trim() ?? "";
    }
  },
  timeSeriesChart: {
    createState(id: string, colStart: number, rowStart: number): WidgetStateByType<"timeSeriesChart"> {
      return TimeSeriesWidget.create(id, colStart, rowStart).toState();
    },
    getDisplayValue(widget: WidgetStateByType | unknown): string {
      return new TimeSeriesWidget(asTimeSeriesState(widget)).getDisplayValue();
    },
    getDisplayValueWithRuntime(
      widget: WidgetStateByType | unknown,
      runtimeValue?: string
    ): string {
      const ts = asTimeSeriesState(widget);
      return new TimeSeriesWidget({
        ...ts,
        config: {
          ...ts.config,
          defaultValue: runtimeValue ?? ts.config.defaultValue
        }
      }).getDisplayValue();
    },
    clampToGrid(
      widget: WidgetStateByType | unknown,
      columns: number,
      rows: number,
      minSpan: number
    ): WidgetStateByType<"timeSeriesChart"> {
      return new TimeSeriesWidget(asTimeSeriesState(widget))
        .clampToGrid(columns, rows, minSpan)
        .toState();
    },
    normalizeConfig(widget: WidgetStateByType | unknown): TimeSeriesConfig {
      return new TimeSeriesWidget(asTimeSeriesState(widget)).toState().config;
    },
    getDisplayConfigFromConfig(config: WidgetConfigMap[WidgetType]): TimeSeriesDisplayConfig {
      const typed = config as TimeSeriesConfig;
      return {
        label: typed.label,
        align: typed.align,
        fontSize:
          (typed as TimeSeriesConfig & { fontSize?: GaugeConfig["fontSize"] }).fontSize ?? "medium",
        min: typed.min,
        max: typed.max,
        format: typed.format,
        decimals: typed.decimals,
        seriesLabelField: typed.seriesLabelField,
        seriesValueField: typed.seriesValueField,
        seriesValueFields: typed.seriesValueFields ?? "",
        strokeWidth: typed.strokeWidth,
        showFill: typed.showFill,
        showGrid: typed.showGrid,
        stacked: typed.stacked
      };
    },
    splitConfigPatch(patch: Partial<WidgetConfigMap[WidgetType]>): {
      displayPatch: TimeSeriesDisplayConfigPatch;
      globalPatch: TimeSeriesGlobalConfigPatch;
    } {
      const typed = patch as Partial<TimeSeriesConfig>;
      const displayPatch: TimeSeriesDisplayConfigPatch = {};
      const globalPatch: TimeSeriesGlobalConfigPatch = {};
      const typedWithCommon = typed as Partial<TimeSeriesConfig> & {
        fontSize?: GaugeConfig["fontSize"];
      };
      if (typed.label !== undefined) displayPatch.label = typed.label;
      if (typed.align !== undefined) displayPatch.align = typed.align;
      if (typedWithCommon.fontSize !== undefined) displayPatch.fontSize = typedWithCommon.fontSize;
      if (typed.min !== undefined) displayPatch.min = typed.min;
      if (typed.max !== undefined) displayPatch.max = typed.max;
      if (typed.format !== undefined) displayPatch.format = typed.format;
      if (typed.decimals !== undefined) displayPatch.decimals = typed.decimals;
      if (typed.seriesLabelField !== undefined) displayPatch.seriesLabelField = typed.seriesLabelField;
      if (typed.seriesValueField !== undefined) displayPatch.seriesValueField = typed.seriesValueField;
      if (typed.seriesValueFields !== undefined) displayPatch.seriesValueFields = typed.seriesValueFields;
      if (typed.strokeWidth !== undefined) displayPatch.strokeWidth = typed.strokeWidth;
      if (typed.showFill !== undefined) displayPatch.showFill = typed.showFill;
      if (typed.showGrid !== undefined) displayPatch.showGrid = typed.showGrid;
      if (typed.stacked !== undefined) displayPatch.stacked = typed.stacked;
      if (typed.apiEndpoint !== undefined) globalPatch.apiEndpoint = typed.apiEndpoint;
      if (typed.field !== undefined) globalPatch.field = typed.field;
      if (typed.defaultValue !== undefined) globalPatch.defaultValue = typed.defaultValue;
      if (typed.updateGroup !== undefined) globalPatch.updateGroup = typed.updateGroup;
      return { displayPatch, globalPatch };
    },
    getFetchSpec(config: WidgetConfigMap[WidgetType]): WidgetFetchSpec {
      const typed = config as TimeSeriesConfig;
      return {
        enabled: !!typed.apiEndpoint,
        endpoint: typed.apiEndpoint,
        field: typed.field,
        fallback: typed.defaultValue
      };
    },
    getUpdateGroup(config: WidgetConfigMap[WidgetType]): string {
      return (config as TimeSeriesConfig).updateGroup?.trim() ?? "";
    }
  },
  mapNetwork: {
    createState(id: string, colStart: number, rowStart: number): WidgetStateByType<"mapNetwork"> {
      return MapWidget.create(id, colStart, rowStart).toState();
    },
    getDisplayValue(widget: WidgetStateByType | unknown): string {
      return new MapWidget(asMapState(widget)).getDisplayValue();
    },
    getDisplayValueWithRuntime(
      widget: WidgetStateByType | unknown,
      runtimeValue?: string
    ): string {
      const w = asMapState(widget);
      return new MapWidget({
        ...w,
        config: { ...w.config, defaultValue: runtimeValue ?? w.config.defaultValue }
      }).getDisplayValue();
    },
    clampToGrid(
      widget: WidgetStateByType | unknown,
      columns: number,
      rows: number,
      minSpan: number
    ): WidgetStateByType<"mapNetwork"> {
      return new MapWidget(asMapState(widget))
        .clampToGrid(columns, rows, minSpan)
        .toState();
    },
    normalizeConfig(widget: WidgetStateByType | unknown): MapConfig {
      return new MapWidget(asMapState(widget)).toState().config;
    },
    getDisplayConfigFromConfig(config: WidgetConfigMap[WidgetType]): MapDisplayConfig {
      const typed = config as MapConfig;
      return {
        label: typed.label,
        align: typed.align,
        fontSize: (typed as MapConfig & { fontSize?: GaugeConfig["fontSize"] }).fontSize ?? "medium",
        mapRegion: typed.mapRegion,
        min: typed.min,
        max: typed.max,
        dotRadiusMin: typed.dotRadiusMin,
        dotRadiusMax: typed.dotRadiusMax,
        format: typed.format,
        decimals: typed.decimals,
        lineBend: typed.lineBend
      };
    },
    splitConfigPatch(patch: Partial<WidgetConfigMap[WidgetType]>): {
      displayPatch: MapDisplayConfigPatch;
      globalPatch: MapGlobalConfigPatch;
    } {
      const typed = patch as Partial<MapConfig>;
      const displayPatch: MapDisplayConfigPatch = {};
      const globalPatch: MapGlobalConfigPatch = {};
      const typedWithCommon = typed as Partial<MapConfig> & {
        fontSize?: GaugeConfig["fontSize"];
      };
      if (typed.label !== undefined) displayPatch.label = typed.label;
      if (typed.align !== undefined) displayPatch.align = typed.align;
      if (typedWithCommon.fontSize !== undefined) displayPatch.fontSize = typedWithCommon.fontSize;
      if (typed.mapRegion !== undefined) displayPatch.mapRegion = typed.mapRegion;
      if (typed.min !== undefined) displayPatch.min = typed.min;
      if (typed.max !== undefined) displayPatch.max = typed.max;
      if (typed.dotRadiusMin !== undefined) displayPatch.dotRadiusMin = typed.dotRadiusMin;
      if (typed.dotRadiusMax !== undefined) displayPatch.dotRadiusMax = typed.dotRadiusMax;
      if (typed.format !== undefined) displayPatch.format = typed.format;
      if (typed.decimals !== undefined) displayPatch.decimals = typed.decimals;
      if (typed.lineBend !== undefined) displayPatch.lineBend = typed.lineBend;
      if (typed.apiEndpoint !== undefined) globalPatch.apiEndpoint = typed.apiEndpoint;
      if (typed.field !== undefined) globalPatch.field = typed.field;
      if (typed.defaultValue !== undefined) globalPatch.defaultValue = typed.defaultValue;
      if (typed.updateGroup !== undefined) globalPatch.updateGroup = typed.updateGroup;
      return { displayPatch, globalPatch };
    },
    getFetchSpec(config: WidgetConfigMap[WidgetType]): WidgetFetchSpec {
      const typed = config as MapConfig;
      return {
        enabled: !!typed.apiEndpoint,
        endpoint: typed.apiEndpoint,
        field: typed.field,
        fallback: typed.defaultValue
      };
    },
    getUpdateGroup(config: WidgetConfigMap[WidgetType]): string {
      return (config as MapConfig).updateGroup?.trim() ?? "";
    }
  }
};

export const widgetLibrary: WidgetLibraryItem[] = [
  { id: "numberGauge", label: "Number Gauge", shortLabel: "Gauge", category: "Data" },
  { id: "label", label: "Label", shortLabel: "Label", category: "Data" },
  { id: "donutChart", label: "Donut Chart", shortLabel: "Donut", category: "Data" },
  { id: "barChart", label: "Bar Chart", shortLabel: "Bar", category: "Data" },
  { id: "sparklineChart", label: "Sparkline", shortLabel: "Spark", category: "Data" },
  { id: "timeSeriesChart", label: "Time Series", shortLabel: "Time", category: "Data" },
  { id: "mapNetwork", label: "Map", shortLabel: "Map", category: "Data" }
];

export { DEFAULT_WIDGET_TYPE };
