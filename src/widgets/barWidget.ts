import { clamp, type WidgetState } from "./baseWidget";
import { BaseChartWidget, type NumberFormat } from "./baseChartWidget";

export type BarOrientation = "horizontal" | "vertical";

export type BarConfig = {
  label: string;
  align: "left" | "center" | "right";
  orientation: BarOrientation;
  min: number;
  max: number;
  format: NumberFormat;
  decimals: 0 | 1 | 2 | 3;
  defaultValue: string;
  seriesLabelField: string;
  seriesValueField: string;
  updateGroup: string;
  apiEndpoint: string;
  field: string;
};

export type BarSeriesPoint = {
  label: string;
  value: number;
  ratio: number;
  formatted: string;
};

export class BarWidget extends BaseChartWidget<"barChart", BarConfig> {
  static create(id: string, colStart: number, rowStart: number): BarWidget {
    return new BarWidget({
      id,
      type: "barChart",
      colStart,
      rowStart,
      colSpan: 18,
      rowSpan: 14,
      config: {
        label: "Throughput",
        align: "left",
        orientation: "horizontal",
        min: 0,
        max: 100,
        format: "compact",
        decimals: 1,
        defaultValue:
          '[{"label":"A","value":63.5},{"label":"B","value":41.2},{"label":"C","value":78.9},{"label":"D","value":55.4},{"label":"E","value":29.8}]',
        seriesLabelField: "label",
        seriesValueField: "value",
        updateGroup: "",
        apiEndpoint: "https://api.foo.com/metrics/throughput",
        field: "value"
      }
    });
  }

  constructor(state: WidgetState<"barChart", BarConfig>) {
    super(state);
  }

  protected instantiate(state: WidgetState<"barChart", BarConfig>): this {
    return new BarWidget(state) as this;
  }

  getNumericValue(): number {
    const fallback = this.safeToFinite(this.config.min, 0);
    return this.safeToFinite(Number(this.config.defaultValue), fallback);
  }

  getDisplayValue(): string {
    return this.formatNumber(this.getNumericValue(), this.config.format, this.config.decimals);
  }

  getSeries(): BarSeriesPoint[] {
    const min = this.safeToFinite(this.config.min, 0);
    const max = this.safeToFinite(this.config.max, min + 1);
    const safeMax = max <= min ? min + 1 : max;
    const ratioFor = (value: number) => clamp((value - min) / (safeMax - min), 0, 1);
    return this.parseSeriesData(this.config.seriesLabelField, this.config.seriesValueField).map(
      (item): BarSeriesPoint => ({
        ...item,
        ratio: ratioFor(item.value),
        formatted: this.formatNumber(item.value, this.config.format, this.config.decimals)
      })
    );
  }

  getRatio(): number {
    const min = this.safeToFinite(this.config.min, 0);
    const max = this.safeToFinite(this.config.max, min + 1);
    const safeMax = max <= min ? min + 1 : max;
    return clamp((this.getNumericValue() - min) / (safeMax - min), 0, 1);
  }
}
