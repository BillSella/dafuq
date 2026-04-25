import { For, createMemo, type Accessor } from "solid-js";
import type { BarConfig } from "../../widgets/barWidget";
import { BarWidget } from "../../widgets/barWidget";
import type { DonutConfig } from "../../widgets/donutWidget";
import { DonutWidget } from "../../widgets/donutWidget";
import type { GaugeConfig } from "../../widgets/gaugeWidget";
import type { LabelConfig } from "../../widgets/labelWidget";
import type { MapConfig } from "../../widgets/mapWidget";
import { MapWidget } from "../../widgets/mapWidget";
import { MAP_VIEW_H, MAP_VIEW_W } from "../../widgets/mapProjections";
import type { SparklineConfig } from "../../widgets/sparklineWidget";
import { SparklineWidget } from "../../widgets/sparklineWidget";
import type { TimeSeriesConfig } from "../../widgets/timeSeriesWidget";
import { TimeSeriesWidget } from "../../widgets/timeSeriesWidget";
import type { WidgetStateByType } from "../../widgets/widgetRegistry";
import type { WidgetRuntimeStatus } from "../../widgetDataService";
import type { DashboardWidget } from "./dashboardEditorConstants";

type DashboardWidgetCardProps = {
  widget: DashboardWidget;
  widgetRefs: Map<string, HTMLDivElement>;
  interaction: Accessor<{ id: string; mode: "dragging" | "resizing" } | null>;
  configWidgetId: Accessor<string | null>;
  setConfigWidgetId: (id: string | null) => void;
  updatePanelPlacement: () => void;
  step: Accessor<number>;
  widgetInset: number;
  runtimeWidgetStatus: Accessor<Record<string, WidgetRuntimeStatus>>;
  runtimeWidgetValues: Accessor<Record<string, string>>;
  getWidgetDisplayValue: (widget: DashboardWidget) => string;
  fontSizeValue: (size: GaugeConfig["fontSize"]) => string;
  textAlignValue: (align: GaugeConfig["align"]) => GaugeConfig["align"];
  dashboardLocked: Accessor<boolean>;
  startWidgetDrag: (event: PointerEvent, widget: DashboardWidget) => void;
  startWidgetResize: (event: PointerEvent, widget: DashboardWidget) => void;
  deleteWidget: (id: string) => void;
};

export function DashboardWidgetCard(props: DashboardWidgetCardProps) {
  const widget = () => props.widget;
  const valueText = createMemo(() => props.getWidgetDisplayValue(widget()));
  const isGauge = () => widget().type === "numberGauge";
  const isDonut = () => widget().type === "donutChart";
  const isBar = () => widget().type === "barChart";
  const isSpark = () => widget().type === "sparklineChart";
  const isTime = () => widget().type === "timeSeriesChart";
  const isMap = () => widget().type === "mapNetwork";
  const runtimeStatus = () => props.runtimeWidgetStatus()[widget().id] ?? "fallback";
  const donutProgress = createMemo(() => {
    if (!isDonut()) return 0;
    const donutState = widget() as WidgetStateByType<"donutChart">;
    return new DonutWidget({
      ...donutState,
      config: {
        ...donutState.config,
        defaultValue: props.runtimeWidgetValues()[widget().id] ?? donutState.config.defaultValue
      }
    }).getRatio();
  });
  const donutSeries = createMemo(() => {
    if (!isDonut()) return [] as ReturnType<DonutWidget["getSeries"]>;
    const donutState = widget() as WidgetStateByType<"donutChart">;
    return new DonutWidget({
      ...donutState,
      config: {
        ...donutState.config,
        defaultValue: props.runtimeWidgetValues()[widget().id] ?? donutState.config.defaultValue
      }
    }).getSeries();
  });
  const donutGradient = createMemo(() => {
    const series = donutSeries();
    if (series.length <= 1) return "";
    const palette = ["#d1ff52", "#60a5fa", "#f59e0b", "#f472b6", "#34d399", "#a78bfa", "#fb7185", "#22d3ee"];
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
    Math.max(6, Math.min(25, Number((widget().config as DonutConfig).ringWidth ?? 13)))
  );
  const donutHolePercent = createMemo(() => Math.max(24, Math.min(88, 100 - donutRingWidth() * 2)));
  const donutStrokeWidth = createMemo(() => Math.max(4, Math.min(24, (88 * donutRingWidth()) / 100)));
  const barRatio = createMemo(() => {
    if (!isBar()) return 0;
    const barState = widget() as WidgetStateByType<"barChart">;
    return new BarWidget({
      ...barState,
      config: {
        ...barState.config,
        defaultValue: props.runtimeWidgetValues()[widget().id] ?? barState.config.defaultValue
      }
    }).getRatio();
  });
  const barSeries = createMemo(() => {
    if (!isBar()) return [] as ReturnType<BarWidget["getSeries"]>;
    const barState = widget() as WidgetStateByType<"barChart">;
    return new BarWidget({
      ...barState,
      config: {
        ...barState.config,
        defaultValue: props.runtimeWidgetValues()[widget().id] ?? barState.config.defaultValue
      }
    }).getSeries();
  });
  const barOrientation = createMemo(() => (isBar() ? (widget().config as BarConfig).orientation : "horizontal"));
  const sparklinePaths = createMemo(() => {
    if (!isSpark()) return { line: "", area: "" };
    const sparkState = widget() as WidgetStateByType<"sparklineChart">;
    const instance = new SparklineWidget({
      ...sparkState,
      config: {
        ...sparkState.config,
        defaultValue: props.runtimeWidgetValues()[widget().id] ?? sparkState.config.defaultValue
      }
    });
    const pts = instance.getPathPoints();
    if (pts.length < 2) return { line: "", area: "" };
    const first = pts[0]!;
    const last = pts[pts.length - 1]!;
    const lineD = `M ${first.x} ${first.y}` + pts.slice(1).map((p) => ` L ${p.x} ${p.y}`).join("");
    let areaD = `M ${first.x} 100 L ${first.x} ${first.y}`;
    for (let i = 1; i < pts.length; i++) areaD += ` L ${pts[i]!.x} ${pts[i]!.y}`;
    areaD += ` L ${last.x} 100 Z`;
    return { line: lineD, area: areaD };
  });
  const timeSeriesViz = createMemo(() => {
    if (!isTime()) {
      return {
        series: [] as { name: string; line: string; area: string; color: string }[],
        x: ["—", "—", "—"] as [string, string, string],
        y: { min: "0", mid: "0", max: "0" },
        hasLine: false
      };
    }
    const tsState = widget() as WidgetStateByType<"timeSeriesChart">;
    const instance = new TimeSeriesWidget({
      ...tsState,
      config: { ...tsState.config, defaultValue: props.runtimeWidgetValues()[widget().id] ?? tsState.config.defaultValue }
    });
    const series = instance.getPathLayers();
    return { series, x: instance.getXAxisLabels(), y: instance.getYAxisLabels(), hasLine: series.some((s) => s.line.length > 0) };
  });
  const mapViz = createMemo(() => {
    if (!isMap()) return { basemap: "", nodes: [] as { id: string; x: number; y: number; r: number; color: string; value: number }[], links: [] as { d: string; color: string; width: number; dash: string }[] };
    const mapState = widget() as WidgetStateByType<"mapNetwork">;
    const instance = new MapWidget({
      ...mapState,
      config: { ...mapState.config, defaultValue: props.runtimeWidgetValues()[widget().id] ?? mapState.config.defaultValue }
    });
    const { nodes, links } = instance.getViz();
    return { basemap: instance.getBasemapD(), nodes, links };
  });

  return (
    <div
      ref={(element) => props.widgetRefs.set(widget().id, element)}
      class={isGauge() ? "number-gauge" : isDonut() ? "donut-chart" : isBar() ? "bar-chart" : isMap() ? "map-network-widget" : isTime() ? "time-series-chart" : isSpark() ? "sparkline-chart" : "text-label"}
      classList={{
        dragging: props.interaction()?.id === widget().id && props.interaction()?.mode === "dragging",
        resizing: props.interaction()?.id === widget().id && props.interaction()?.mode === "resizing",
        editing: props.configWidgetId() === widget().id,
        "runtime-live": runtimeStatus() === "live",
        "runtime-fallback": runtimeStatus() === "fallback",
        "runtime-error": runtimeStatus() === "error",
        "runtime-static": runtimeStatus() === "static"
      }}
      style={{
        left: `${(widget().colStart - 1) * props.step() + props.widgetInset}px`,
        top: `${(widget().rowStart - 1) * props.step() + props.widgetInset}px`,
        width: `${Math.max(1, widget().colSpan * props.step() - props.widgetInset * 2)}px`,
        height: `${Math.max(1, widget().rowSpan * props.step() - props.widgetInset * 2)}px`,
        "--donut-size": `${Math.max(24, Math.min(Math.max(1, widget().colSpan * props.step() - props.widgetInset * 2), Math.max(1, widget().rowSpan * props.step() - props.widgetInset * 2)) - 16)}px`,
        "font-size": props.fontSizeValue("fontSize" in widget().config && widget().config.fontSize ? widget().config.fontSize : "medium")
      }}
      onPointerDown={(event) => props.startWidgetDrag(event, widget())}
    >
      <button
        class="config-toggle"
        type="button"
        aria-label="Configure widget"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          if (props.dashboardLocked()) return;
          event.stopPropagation();
          props.setConfigWidgetId(props.configWidgetId() === widget().id ? null : widget().id);
          queueMicrotask(props.updatePanelPlacement);
        }}
      >
        ⚙
      </button>
      {isGauge() ? (
        <>
          <div class="gauge-source" style={{ "text-align": props.textAlignValue((widget().config as GaugeConfig).align) }}>{(widget().config as GaugeConfig).label}</div>
          <div class="gauge-value">{valueText()}</div>
        </>
      ) : isDonut() ? (
        <div class="donut-chart-body">
          <div class="donut-visual-shell">
            {donutSeries().length > 1 ? (
              <>
                <div class="donut-multi-ring" style={{ background: donutGradient() }} />
                <div class="donut-multi-hole" style={{ width: `${donutHolePercent()}%`, height: `${donutHolePercent()}%` }} />
              </>
            ) : (
              <svg class="donut-chart-svg" viewBox="0 0 120 120" aria-hidden="true">
                <circle class="donut-track" cx="60" cy="60" r="44" style={{ "stroke-width": String(donutStrokeWidth()) }} />
                <circle class="donut-progress" cx="60" cy="60" r="44" style={{ "stroke-width": String(donutStrokeWidth()) }} stroke-dasharray={`${donutCircumference} ${donutCircumference}`} stroke-dashoffset={`${donutCircumference * (1 - donutProgress())}`} />
              </svg>
            )}
          </div>
          <div class="donut-center">
            <div class="donut-value">{donutSeries().length > 1 ? donutSeries().reduce((sum, item) => sum + item.value, 0).toFixed((widget().config as DonutConfig).decimals) : valueText()}</div>
            <div class="donut-label" style={{ "text-align": (widget().config as DonutConfig).align }}>{(widget().config as DonutConfig).label}</div>
          </div>
        </div>
      ) : isSpark() ? (
        <div class="sparkline-chart-body">
          <div class="sparkline-header">
            <span class="sparkline-label" style={{ "text-align": (widget().config as SparklineConfig).align }}>{(widget().config as SparklineConfig).label}</span>
            <span class="sparkline-latest">{valueText()}</span>
          </div>
          <div class="sparkline-visual">
            <svg class="sparkline-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              {sparklinePaths().area && (widget().config as SparklineConfig).showFill ? <path class="sparkline-area" d={sparklinePaths().area} /> : null}
              {sparklinePaths().line ? (
                <path class="sparkline-stroke" d={sparklinePaths().line} fill="none" style={{ "stroke-width": String(Math.max(0.35, Math.min(2.2, (widget().config as SparklineConfig).strokeWidth / 2.2))) }} />
              ) : (
                <text class="sparkline-empty" x="50" y="55" text-anchor="middle">No data</text>
              )}
            </svg>
          </div>
        </div>
      ) : isBar() ? (
        <div class="bar-chart-body">
          <div class="bar-chart-header">
            <span class="bar-chart-label" style={{ "text-align": (widget().config as BarConfig).align }}>{(widget().config as BarConfig).label}</span>
          </div>
          <div class="bar-series" classList={{ horizontal: barOrientation() === "horizontal", vertical: barOrientation() === "vertical" }}>
            <For each={barSeries().length > 0 ? barSeries() : [{ label: "Item 1", value: 0, ratio: barRatio(), formatted: valueText() }]}>
              {(entry) => (
                <div class="bar-item">
                  <div class="bar-item-label" title={entry.label}>{entry.label}</div>
                  <div class="bar-track">
                    <div class="bar-fill" style={barOrientation() === "horizontal" ? { width: `${Math.round(entry.ratio * 100)}%` } : { height: `${Math.max(2, Math.round(entry.ratio * 100))}%` }} />
                  </div>
                  <div class="bar-item-value">{entry.formatted}</div>
                </div>
              )}
            </For>
          </div>
        </div>
      ) : isMap() ? (
        <div class="map-network-body">
          <div class="map-network-header" style={{ "text-align": (widget().config as MapConfig).align }}>{(widget().config as MapConfig).label}</div>
          <div class="map-network-visual">
            <svg class="map-network-svg" viewBox={`0 0 ${MAP_VIEW_W} ${MAP_VIEW_H}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
              <rect class="map-network-ocean" x="0" y="0" width={MAP_VIEW_W} height={MAP_VIEW_H} />
              <path class="map-network-land" d={mapViz().basemap} />
              <For each={mapViz().links}>
                {(L) => <path class="map-network-link" d={L.d} fill="none" style={{ stroke: L.color, "stroke-width": String(L.width), ...(L.dash ? { "stroke-dasharray": L.dash } : {}), "stroke-linecap": "round", "stroke-linejoin": "round" }} />}
              </For>
              <For each={mapViz().nodes}>
                {(N) => <circle class="map-network-node" cx={N.x} cy={N.y} r={N.r} fill={N.color} />}
              </For>
            </svg>
          </div>
          <div class="map-network-footer" aria-hidden="true">{valueText()}</div>
        </div>
      ) : isTime() ? (
        <div class="time-series-chart-body">
          <div class="time-series-header">
            <span class="time-series-title" style={{ "text-align": (widget().config as TimeSeriesConfig).align }}>{(widget().config as TimeSeriesConfig).label}</span>
          </div>
          {timeSeriesViz().series.length > 1 ? (
            <div class="time-series-legend" aria-hidden="true">
              <For each={timeSeriesViz().series}>
                {(s) => (
                  <span class="time-series-legend-item" title={s.name}>
                    <span class="time-series-legend-swatch" style={{ "background-color": s.color }} />
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
              <svg class="time-series-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                {(widget().config as TimeSeriesConfig).showGrid ? (
                  <g class="time-series-grid" opacity="0.35">
                    <line x1="0" y1="0" x2="100" y2="0" />
                    <line x1="0" y1="25" x2="100" y2="25" />
                    <line x1="0" y1="50" x2="100" y2="50" />
                    <line x1="0" y1="75" x2="100" y2="75" />
                    <line x1="0" y1="100" x2="100" y2="100" />
                  </g>
                ) : null}
                {(widget().config as TimeSeriesConfig).showFill ? (
                  <For each={timeSeriesViz().series.filter((s) => s.area.length > 0)}>
                    {(s) => (
                      <path class="time-series-area-path" d={s.area} fill={s.color} style={{ opacity: timeSeriesViz().series.length <= 1 ? 0.2 : (widget().config as TimeSeriesConfig).stacked ? 0.24 : 0.12 }} />
                    )}
                  </For>
                ) : null}
                {timeSeriesViz().hasLine ? (
                  <For each={timeSeriesViz().series.filter((s) => s.line.length > 0)}>
                    {(s) => (
                      <path d={s.line} fill="none" class="time-series-stroke" style={{ stroke: s.color, "stroke-width": String(Math.max(0.35, Math.min(2, (widget().config as TimeSeriesConfig).strokeWidth / 2.4))) }} />
                    )}
                  </For>
                ) : (
                  <text class="time-series-empty" x="50" y="55" text-anchor="middle">No data</text>
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
        <div class="label-value" style={{ "text-align": (widget().config as LabelConfig).align }}>{valueText()}</div>
      )}
      <button class="resize-handle" type="button" onPointerDown={(event) => props.startWidgetResize(event, widget())} />
      <button
        class="delete-handle"
        type="button"
        aria-label="Delete widget"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          if (props.dashboardLocked()) return;
          event.stopPropagation();
          props.deleteWidget(widget().id);
        }}
      >
        🗑
      </button>
    </div>
  );
}
