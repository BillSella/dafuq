import { BaseChartWidget, type NumberFormat } from "./baseChartWidget";
import type { WidgetState } from "./baseWidget";

export type GaugeFontSize = "small" | "medium" | "large";
export type GaugeAlign = "left" | "center" | "right";

export type GaugeConfig = {
  label: string;
  fontSize: GaugeFontSize;
  align: GaugeAlign;
  defaultValue: string;
  updateGroup: string;
  format: NumberFormat;
  decimalPlaces: 0 | 1 | 2 | 3;
  apiEndpoint: string;
  field: string;
};

/**
 * Simplest concrete widget implementation and baseline for new widgets.
 * Includes:
 * - default config factory
 * - immutable patch behavior inherited from BaseWidget
 * - value display parsing/formatting rules
 */
export class GaugeWidget extends BaseChartWidget<"numberGauge", GaugeConfig> {
  /** Create default gauge state used by widget library drops. */
  static create(id: string, colStart: number, rowStart: number): GaugeWidget {
    return new GaugeWidget({
      id,
      type: "numberGauge",
      colStart,
      rowStart,
      colSpan: 16,
      rowSpan: 16,
      config: {
        label: "Primary Sensor",
        fontSize: "medium",
        align: "center",
        defaultValue: "1234.567",
        updateGroup: "",
        format: "compact",
        decimalPlaces: 1,
        apiEndpoint: "https://api.foo.com/metrics/primary-sensor",
        field: "value"
      }
    });
  }

  constructor(state: WidgetState<"numberGauge", GaugeConfig>) {
    super(state);
  }

  protected instantiate(state: WidgetState<"numberGauge", GaugeConfig>): this {
    return new GaugeWidget(state) as this;
  }

  /**
   * Resolve what the widget displays:
   * - numeric text -> apply selected format/decimals
   * - non-numeric text -> display as-is (e.g. "No Data")
   */
  getDisplayValue(): string {
    const parsed = Number(this.config.defaultValue);
    return Number.isFinite(parsed)
      ? this.formatNumber(parsed, this.config.format, this.config.decimalPlaces)
      : this.config.defaultValue;
  }
}
