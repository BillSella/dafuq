import { clamp, type WidgetState } from "./baseWidget";
import { BaseChartWidget, type NumberFormat } from "./baseChartWidget";

export type DonutConfig = {
  label: string;
  align: "left" | "center" | "right";
  ringWidth: number;
  min: number;
  max: number;
  decimals: 0 | 1 | 2 | 3;
  format: NumberFormat;
  defaultValue: string;
  seriesLabelField: string;
  seriesValueField: string;
  updateGroup: string;
  apiEndpoint: string;
  field: string;
};

export type DonutSeriesPoint = {
  label: string;
  value: number;
  ratio: number;
  formatted: string;
};

export class DonutWidget extends BaseChartWidget<"donutChart", DonutConfig> {
  static create(id: string, colStart: number, rowStart: number): DonutWidget {
    return new DonutWidget({
      id,
      type: "donutChart",
      colStart,
      rowStart,
      colSpan: 18,
      rowSpan: 18,
      config: {
        label: "Utilization",
        align: "center",
        ringWidth: 13,
        min: 0,
        max: 100,
        decimals: 1,
        format: "compact",
        defaultValue:
          '[{"label":"A","value":34.2},{"label":"B","value":22.8},{"label":"C","value":18.4},{"label":"D","value":14.1},{"label":"E","value":10.5}]',
        seriesLabelField: "label",
        seriesValueField: "value",
        updateGroup: "",
        apiEndpoint: "https://api.foo.com/metrics/utilization",
        field: "value"
      }
    });
  }

  constructor(state: WidgetState<"donutChart", DonutConfig>) {
    super(state);
  }

  protected instantiate(state: WidgetState<"donutChart", DonutConfig>): this {
    return new DonutWidget(state) as this;
  }

  getDisplayValue(): string {
    const value = this.getNumericValue();
    return this.formatNumber(value, this.config.format, this.config.decimals);
  }

  getSeries(): DonutSeriesPoint[] {
    const rawSeries = this.parseSeriesData(this.config.seriesLabelField, this.config.seriesValueField);
    if (rawSeries.length === 0) {
      return [];
    }

    const total = rawSeries.reduce((sum, item) => sum + Math.max(0, item.value), 0);
    if (total <= 0) return [];
    return rawSeries.map((item) => ({
      ...item,
      ratio: Math.max(0, item.value) / total,
      formatted: this.formatNumber(item.value, this.config.format, this.config.decimals)
    }));
  }

  getNumericValue(): number {
    const fallback = this.safeToFinite(this.config.min, 0);
    return this.safeToFinite(Number(this.config.defaultValue), fallback);
  }

  getRatio(): number {
    const min = this.safeToFinite(this.config.min, 0);
    const max = this.safeToFinite(this.config.max, min + 1);
    const safeMax = max <= min ? min + 1 : max;
    const value = this.getNumericValue();
    return clamp((value - min) / (safeMax - min), 0, 1);
  }
}
