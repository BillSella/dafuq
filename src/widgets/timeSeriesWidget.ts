import { clamp, type WidgetState } from "./baseWidget";
import { BaseChartWidget, type NumberFormat } from "./baseChartWidget";

function parseTimeMs(label: string): number {
  const trimmed = (label ?? "").trim();
  if (!trimmed) return NaN;
  const asNum = Number(trimmed);
  if (Number.isFinite(asNum) && asNum > 1e9) {
    if (asNum > 1e12) return asNum;
    return asNum * 1000;
  }
  const d = Date.parse(trimmed);
  return Number.isFinite(d) ? d : NaN;
}

function shortTimeLabel(timeMs: number): string {
  if (!Number.isFinite(timeMs)) return "—";
  return new Date(timeMs).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export const TIME_SERIES_PALETTE = [
  "var(--brand-accent)",
  "#60a5fa",
  "#f59e0b",
  "#f472b6",
  "#34d399",
  "#a78bfa",
  "#fb7185",
  "#22d3ee"
] as const;

export type TimeSeriesConfig = {
  label: string;
  align: "left" | "center" | "right";
  min: number;
  max: number;
  format: NumberFormat;
  decimals: 0 | 1 | 2 | 3;
  defaultValue: string;
  seriesLabelField: string;
  /** Legacy single value field; used when `seriesValueFields` is empty. */
  seriesValueField: string;
  /** Comma- or line-separated value keys (wide rows). If empty, `seriesValueField` is used. */
  seriesValueFields?: string;
  strokeWidth: number;
  showFill: boolean;
  showGrid: boolean;
  /** Stack series into cumulative areas/lines (shared time axis, Y = sum of components). */
  stacked?: boolean;
  updateGroup: string;
  apiEndpoint: string;
  field: string;
};

export type TimeSeriesDataPoint = {
  timeMs: number;
  value: number;
  rawTime: string;
};

export type TimeSeriesPathLayer = {
  name: string;
  line: string;
  area: string;
  color: string;
};

const DEFAULT_TIME_SERIES = `[
  {"t":"2024-06-10T08:00:00.000Z","a":4.2,"b":2.1},
  {"t":"2024-06-10T10:00:00.000Z","a":3.8,"b":2.4},
  {"t":"2024-06-10T12:00:00.000Z","a":7.2,"b":3.2},
  {"t":"2024-06-10T14:00:00.000Z","a":8.1,"b":2.8},
  {"t":"2024-06-10T16:00:00.000Z","a":9.0,"b":3.5},
  {"t":"2024-06-10T18:00:00.000Z","a":8.4,"b":3.1}
]`;

function lineAndAreaFromPoints(pts: { x: number; y: number }[]): { line: string; area: string } {
  if (pts.length < 2) return { line: "", area: "" };
  const first = pts[0]!;
  const last = pts[pts.length - 1]!;
  const line = `M ${first.x} ${first.y}` + pts.slice(1).map((p) => ` L ${p.x} ${p.y}`).join("");
  let area = `M ${first.x} 100 L ${first.x} ${first.y}`;
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i]!;
    area += ` L ${p.x} ${p.y}`;
  }
  area += ` L ${last.x} 100 Z`;
  return { line, area };
}

function bandPath(
  top: { x: number; y: number }[],
  bottom: { x: number; y: number }[]
): { line: string; area: string } {
  if (top.length < 2 || bottom.length !== top.length) return { line: "", area: "" };
  const t0 = top[0]!;
  const line = `M ${t0.x} ${t0.y}` + top.slice(1).map((p) => ` L ${p.x} ${p.y}`).join("");
  let area = `M ${t0.x} ${t0.y}`;
  for (let i = 1; i < top.length; i++) {
    const p = top[i]!;
    area += ` L ${p.x} ${p.y}`;
  }
  const bl = bottom[bottom.length - 1]!;
  area += ` L ${bl.x} ${bl.y}`;
  for (let i = bottom.length - 2; i >= 0; i--) {
    const p = bottom[i]!;
    area += ` L ${p.x} ${p.y}`;
  }
  area += " Z";
  return { line, area };
}

export class TimeSeriesWidget extends BaseChartWidget<"timeSeriesChart", TimeSeriesConfig> {
  static create(id: string, colStart: number, rowStart: number): TimeSeriesWidget {
    return new TimeSeriesWidget({
      id,
      type: "timeSeriesChart",
      colStart,
      rowStart,
      colSpan: 20,
      rowSpan: 16,
      config: {
        label: "Requests / min",
        align: "left",
        min: 0,
        max: 12,
        format: "compact",
        decimals: 1,
        defaultValue: DEFAULT_TIME_SERIES,
        seriesLabelField: "t",
        seriesValueField: "a",
        seriesValueFields: "a, b",
        strokeWidth: 2.2,
        showFill: true,
        showGrid: true,
        stacked: false,
        updateGroup: "",
        apiEndpoint: "https://api.foo.com/metrics/requests",
        field: "value"
      }
    });
  }

  constructor(state: WidgetState<"timeSeriesChart", TimeSeriesConfig>) {
    super(state);
  }

  protected instantiate(state: WidgetState<"timeSeriesChart", TimeSeriesConfig>): this {
    return new TimeSeriesWidget(state) as this;
  }

  getValueFieldKeys(): string[] {
    const list = (this.config.seriesValueFields ?? "").trim();
    if (list.length > 0) {
      return list
        .split(/[,\n;]+/)
        .map((k) => k.trim())
        .filter(Boolean);
    }
    return [(this.config.seriesValueField || "v").trim() || "v"];
  }

  private getRawRows(): unknown[] {
    const source = this.getDefaultValueInput();
    if (Array.isArray(source)) return source;
    if (source && typeof source === "object" && !Array.isArray(source)) {
      const record = source as Record<string, unknown>;
      const found = Object.values(record).find((v) => Array.isArray(v));
      if (Array.isArray(found)) return found;
    }
    return [];
  }

  /**
   * One entry per Y column; time-aligned rows from wide JSON, or a single series from
   * legacy `parseSeriesData` (numeric / simple arrays).
   */
  getAllSeriesData(): { name: string; data: TimeSeriesDataPoint[] }[] {
    const keys = this.getValueFieldKeys();
    const timeKey = (this.config.seriesLabelField || "t").trim() || "t";
    const rows = this.getRawRows();

    if (
      rows.length > 0 &&
      rows.some((r) => r && typeof r === "object" && !Array.isArray(r))
    ) {
      const byKey: { name: string; data: TimeSeriesDataPoint[] }[] = [];
      for (const valueKey of keys) {
        const points: TimeSeriesDataPoint[] = [];
        for (const row of rows) {
          if (!row || typeof row !== "object" || Array.isArray(row)) continue;
          const r = row as Record<string, unknown>;
          const rawT = r[timeKey] ?? r.t ?? r.time;
          const rawV = r[valueKey];
          if (rawV === undefined) continue;
          const v = Number(rawV);
          if (!Number.isFinite(v)) continue;
          const tStr = rawT != null ? String(rawT) : "";
          const tms = parseTimeMs(tStr);
          if (!Number.isFinite(tms)) continue;
          points.push({ timeMs: tms, value: v, rawTime: tStr });
        }
        if (points.length > 0) {
          points.sort((a, b) => a.timeMs - b.timeMs);
          byKey.push({ name: valueKey, data: points });
        }
      }
      if (byKey.length > 0) return byKey;
    }

    const legacy = this.parseSeriesData(
      this.config.seriesLabelField,
      this.config.seriesValueField
    );
    const mapped: TimeSeriesDataPoint[] = legacy
      .map((d) => {
        const t = parseTimeMs(d.label);
        return { timeMs: t, value: d.value, rawTime: d.label };
      })
      .filter((d) => Number.isFinite(d.timeMs) && Number.isFinite(d.value));
    if (mapped.length === 0) {
      const indexFallback = legacy
        .map((d, i) => ({
          timeMs: i,
          value: d.value,
          rawTime: d.label
        }))
        .filter((d) => Number.isFinite(d.value));
      if (indexFallback.length > 0) {
        return [{ name: keys[0] || "v", data: indexFallback }];
      }
      return [];
    }
    mapped.sort((a, b) => a.timeMs - b.timeMs);
    return [{ name: keys[0] || "v", data: mapped }];
  }

  getGlobalTimeExtent(
    all: { name: string; data: TimeSeriesDataPoint[] }[]
  ): { tMin: number; tMax: number } {
    const times = all.flatMap((s) => s.data.map((p) => p.timeMs));
    if (times.length === 0) return { tMin: 0, tMax: 1 };
    return { tMin: Math.min(...times), tMax: Math.max(...times) };
  }

  private yPixelValue(v: number): number {
    const yMin = this.safeToFinite(this.config.min, 0);
    const yMax = this.safeToFinite(this.config.max, yMin + 1);
    const ySafe = yMax <= yMin ? yMin + 1 : yMax;
    const y = 100 * (1 - (clamp(v, yMin, ySafe) - yMin) / (ySafe - yMin));
    return clamp(y, 0, 100);
  }

  private valueAtSeries(series: { data: TimeSeriesDataPoint[] }, t: number): number {
    const hit = series.data.find((d) => d.timeMs === t);
    return hit ? hit.value : 0;
  }

  projectToPath(
    data: TimeSeriesDataPoint[],
    tMin: number,
    tMax: number
  ): { x: number; y: number }[] {
    if (data.length === 0) return [];
    if (data.length === 1) {
      const d = data[0]!;
      const yv = this.yPixelValue(d.value);
      return [
        { x: 40, y: yv },
        { x: 60, y: yv }
      ];
    }
    const tSpan = tMax - tMin;
    if (tSpan <= 0) {
      return data.map((d, i) => {
        const x = data.length <= 1 ? 50 : (i / (data.length - 1)) * 100;
        return { x, y: this.yPixelValue(d.value) };
      });
    }
    return data.map((d) => {
      const x = ((d.timeMs - tMin) / tSpan) * 100;
      return { x: clamp(x, 0, 100), y: this.yPixelValue(d.value) };
    });
  }

  getPathLayersStacked(
    all: { name: string; data: TimeSeriesDataPoint[] }[]
  ): TimeSeriesPathLayer[] {
    const timeSet = new Set<number>();
    for (const s of all) {
      for (const p of s.data) timeSet.add(p.timeMs);
    }
    const times = [...timeSet].sort((a, b) => a - b);
    if (times.length === 0) return [];

    const tMinT = times[0]!;
    const tMaxT = times[times.length - 1]!;
    const tSpanT = tMaxT - tMinT;
    const xAt = (t: number) =>
      tSpanT <= 0
        ? 50
        : clamp(((t - tMinT) / tSpanT) * 100, 0, 100);

    return all.map((series, j) => {
      const topVals: number[] = [];
      const bottomVals: number[] = [];
      for (const t of times) {
        const vals = all.map((s) => this.valueAtSeries(s, t));
        let below = 0;
        for (let k = 0; k < j; k++) {
          below += vals[k] ?? 0;
        }
        const vj = vals[j] ?? 0;
        const top = below + vj;
        bottomVals.push(below);
        topVals.push(top);
      }

      if (times.length === 1) {
        const b = bottomVals[0]!;
        const tp = topVals[0]!;
        const yb = this.yPixelValue(b);
        const yTop = this.yPixelValue(tp);
        const topPts = [
          { x: 40, y: yTop },
          { x: 60, y: yTop }
        ];
        const bottomPts = [
          { x: 40, y: yb },
          { x: 60, y: yb }
        ];
        const { line, area } = bandPath(topPts, bottomPts);
        return {
          name: series.name,
          line,
          area,
          color: TIME_SERIES_PALETTE[j % TIME_SERIES_PALETTE.length]!
        };
      }

      const topPts = times.map((t, i) => ({
        x: xAt(t),
        y: this.yPixelValue(topVals[i]!)
      }));
      const bottomPts = times.map((t, i) => ({
        x: xAt(t),
        y: this.yPixelValue(bottomVals[i]!)
      }));
      const { line, area } = bandPath(topPts, bottomPts);
      return {
        name: series.name,
        line,
        area,
        color: TIME_SERIES_PALETTE[j % TIME_SERIES_PALETTE.length]!
      };
    });
  }

  getPathLayers(): TimeSeriesPathLayer[] {
    const all = this.getAllSeriesData();
    if (all.length === 0) return [];
    if (this.config.stacked && all.length > 1) {
      return this.getPathLayersStacked(all);
    }
    const { tMin, tMax } = this.getGlobalTimeExtent(all);
    return all.map((s, i) => {
      const pts = this.projectToPath(s.data, tMin, tMax);
      const { line, area } = lineAndAreaFromPoints(pts);
      return {
        name: s.name,
        line,
        area,
        color: TIME_SERIES_PALETTE[i % TIME_SERIES_PALETTE.length]!
      };
    });
  }

  getDisplayValue(): string {
    const all = this.getAllSeriesData();
    if (all.length === 0) return "—";
    if (this.config.stacked && all.length > 1) {
      const timeSet = new Set<number>();
      for (const s of all) {
        for (const p of s.data) timeSet.add(p.timeMs);
      }
      const times = [...timeSet].sort((a, b) => a - b);
      if (times.length === 0) return "—";
      const lastT = times[times.length - 1]!;
      let sum = 0;
      for (const s of all) {
        sum += this.valueAtSeries(s, lastT);
      }
      return this.formatNumber(sum, this.config.format, this.config.decimals);
    }
    if (all.length === 1) {
      const d = all[0]!.data;
      if (d.length === 0) return "—";
      const last = d[d.length - 1]!;
      return this.formatNumber(last.value, this.config.format, this.config.decimals);
    }
    return all
      .map((s) => {
        if (s.data.length === 0) return `${s.name}: —`;
        const last = s.data[s.data.length - 1]!;
        return `${s.name} ${this.formatNumber(last.value, this.config.format, this.config.decimals)}`;
      })
      .join(" · ");
  }

  getXAxisLabels(): [string, string, string] {
    const all = this.getAllSeriesData();
    const points: TimeSeriesDataPoint[] = [];
    const seen = new Set<number>();
    for (const s of all) {
      for (const p of s.data) {
        if (seen.has(p.timeMs)) continue;
        seen.add(p.timeMs);
        points.push(p);
      }
    }
    points.sort((a, b) => a.timeMs - b.timeMs);
    if (points.length === 0) return ["—", "—", "—"];
    const tick = (p: TimeSeriesDataPoint) => {
      if (p.rawTime.trim() && p.timeMs < 1e6) {
        const r = p.rawTime.trim();
        return r.length > 16 ? `${r.slice(0, 14)}…` : r;
      }
      return shortTimeLabel(p.timeMs);
    };
    if (points.length === 1) {
      const s = tick(points[0]!);
      return [s, s, s];
    }
    const i0 = 0;
    const i1 = Math.floor((points.length - 1) / 2);
    const i2 = points.length - 1;
    return [tick(points[i0]!), tick(points[i1]!), tick(points[i2]!)];
  }

  getYAxisLabels(): { min: string; mid: string; max: string } {
    const yMin = this.safeToFinite(this.config.min, 0);
    const yMax = this.safeToFinite(this.config.max, yMin + 1);
    const ySafe = yMax <= yMin ? yMin + 1 : yMax;
    const mid = (yMin + ySafe) / 2;
    return {
      min: this.formatNumber(yMin, this.config.format, this.config.decimals),
      mid: this.formatNumber(mid, this.config.format, this.config.decimals),
      max: this.formatNumber(ySafe, this.config.format, this.config.decimals)
    };
  }
}
