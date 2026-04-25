import { describe, expect, it } from "vitest";
import { BaseChartWidget, type NumberFormat } from "./baseChartWidget";
import type { WidgetState } from "./baseWidget";

type TestChartConfig = {
  defaultValue: string;
  format: NumberFormat;
};

class TestChartWidget extends BaseChartWidget<"testChart", TestChartConfig> {
  constructor(state: WidgetState<"testChart", TestChartConfig>) {
    super(state);
  }

  protected instantiate(state: WidgetState<"testChart", TestChartConfig>): this {
    return new TestChartWidget(state) as this;
  }

  exposeDefaultValueInput() {
    return this.getDefaultValueInput();
  }

  exposeParseSeriesData(labelField: string, valueField: string) {
    return this.parseSeriesData(labelField, valueField);
  }

  exposeFormatNumber(value: number, format: NumberFormat, decimals: number) {
    return this.formatNumber(value, format, decimals);
  }
}

function createChart(defaultValue: string): TestChartWidget {
  return new TestChartWidget({
    id: "c1",
    type: "testChart",
    colStart: 1,
    rowStart: 1,
    colSpan: 4,
    rowSpan: 4,
    config: {
      defaultValue,
      format: "compact"
    }
  });
}

describe("baseChartWidget", () => {
  it("parses default value from JSON arrays and object rows", () => {
    const chart = createChart('[{"name":"A","amount":12},{"name":"B","amount":18}]');
    const parsed = chart.exposeParseSeriesData("name", "amount");
    expect(parsed).toEqual([
      { label: "A", value: 12 },
      { label: "B", value: 18 }
    ]);
  });

  it("parses comma separated numeric values with fallback labels", () => {
    const chart = createChart("10,20, 30");
    const parsed = chart.exposeParseSeriesData("", "");
    expect(parsed).toEqual([
      { label: "Item 1", value: 10 },
      { label: "Item 2", value: 20 },
      { label: "Item 3", value: 30 }
    ]);
  });

  it("returns single datum for scalar default value", () => {
    const chart = createChart("42");
    expect(chart.exposeParseSeriesData("", "")).toEqual([{ label: "Item 1", value: 42 }]);
  });

  it("formats full and compact numbers deterministically", () => {
    const chart = createChart("1");
    expect(chart.exposeFormatNumber(1234.567, "full", 2)).toBe("1,234.57");
    expect(chart.exposeFormatNumber(1234.567, "compact", 1)).toBe("1.2k");
    expect(chart.exposeFormatNumber(0, "compact", 2)).toBe("0.00");
  });

  it("returns raw string for invalid JSON payload", () => {
    const chart = createChart("{bad json}");
    expect(chart.exposeDefaultValueInput()).toBe("{bad json}");
  });
});

