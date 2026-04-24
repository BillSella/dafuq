import { clamp, type WidgetState } from "./baseWidget";
import { BaseChartWidget, type NumberFormat } from "./baseChartWidget";

export type SparklineConfig = {
  label: string;
  align: "left" | "center" | "right";
  min: number;
  max: number;
  format: NumberFormat;
  decimals: 0 | 1 | 2 | 3;
  defaultValue: string;
  seriesLabelField: string;
  seriesValueField: string;
  strokeWidth: number;
  showFill: boolean;
  updateGroup: string;
  apiEndpoint: string;
  field: string;
};

export class SparklineWidget extends BaseChartWidget<"sparklineChart", SparklineConfig> {
  static create(id: string, colStart: number, rowStart: number): SparklineWidget {
    return new SparklineWidget({
      id,
      type: "sparklineChart",
      colStart,
      rowStart,
      colSpan: 16,
      rowSpan: 8,
      config: {
        label: "Latency",
        align: "left",
        min: 0,
        max: 100,
        format: "compact",
        decimals: 1,
        defaultValue: "[12,19,16,24,30,28,35,32,40,38,44,42,48,52,50,55,58,54,60,62,58,65]",
        seriesLabelField: "label",
        seriesValueField: "value",
        strokeWidth: 2.5,
        showFill: true,
        updateGroup: "",
        apiEndpoint: "https://api.foo.com/metrics/latency",
        field: "value"
      }
    });
  }

  constructor(state: WidgetState<"sparklineChart", SparklineConfig>) {
    super(state);
  }

  protected instantiate(state: WidgetState<"sparklineChart", SparklineConfig>): this {
    return new SparklineWidget(state) as this;
  }

  getValues(): number[] {
    return this.parseSeriesData(this.config.seriesLabelField, this.config.seriesValueField).map(
      (d) => d.value
    );
  }

  getDisplayValue(): string {
    const values = this.getValues();
    if (values.length === 0) return "—";
    const last = values[values.length - 1]!;
    return this.formatNumber(last, this.config.format, this.config.decimals);
  }

  /**
   * Normalized polyline in a 0–100 square (x: time, y: value with 0 = top of chart).
   */
  getPathPoints(): { x: number; y: number }[] {
    const values = this.getValues();
    const min = this.safeToFinite(this.config.min, 0);
    const max = this.safeToFinite(this.config.max, min + 1);
    const safeMax = max <= min ? min + 1 : max;
    if (values.length === 0) return [];
    if (values.length === 1) {
      const v = clamp(values[0]!, min, safeMax);
      const y = 100 * (1 - (v - min) / (safeMax - min));
      return [
        { x: 40, y: clamp(y, 0, 100) },
        { x: 60, y: clamp(y, 0, 100) }
      ];
    }
    const n = values.length;
    return values.map((raw, i) => {
      const t = n <= 1 ? 0.5 : i / (n - 1);
      const v = clamp(raw, min, safeMax);
      const y = 100 * (1 - (v - min) / (safeMax - min));
      return { x: t * 100, y: clamp(y, 0, 100) };
    });
  }
}
