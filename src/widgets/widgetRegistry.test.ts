import { describe, expect, it } from "vitest";
import { DEFAULT_WIDGET_TYPE, widgetRegistry, widgetLibrary } from "./widgetRegistry";

describe("widgetRegistry", () => {
  it("exposes number gauge as default and in library", () => {
    expect(DEFAULT_WIDGET_TYPE).toBe("numberGauge");
    expect(widgetLibrary.some((item) => item.id === "numberGauge")).toBe(true);
  });

  it("splits gauge patches into display and global sections", () => {
    const { displayPatch, globalPatch } = widgetRegistry.numberGauge.splitConfigPatch({
      label: "CPU",
      align: "left",
      decimalPlaces: 3,
      apiEndpoint: "https://api.example.com/cpu",
      defaultValue: "99.1"
    });

    expect(displayPatch).toMatchObject({
      label: "CPU",
      align: "left",
      decimalPlaces: 3
    });
    expect(globalPatch).toMatchObject({
      apiEndpoint: "https://api.example.com/cpu",
      defaultValue: "99.1"
    });
  });

  it("returns label widget runtime values based on source mode", () => {
    const labelStatic = widgetRegistry.label.createState("w-label", 1, 1);
    expect(labelStatic.type).toBe("label");
    const staticValue = widgetRegistry.label.getDisplayValueWithRuntime(labelStatic, "runtime");
    expect(staticValue).toBe((labelStatic.config as import("./labelWidget").LabelConfig).staticText);

    const labelApi = {
      ...labelStatic,
      config: { ...labelStatic.config, sourceMode: "api" as const, fallbackText: "Fallback" }
    };
    expect(widgetRegistry.label.getDisplayValueWithRuntime(labelApi, "Runtime Label")).toBe(
      "Runtime Label"
    );
    expect(widgetRegistry.label.getDisplayValueWithRuntime(labelApi)).toBe("Fallback");
  });

  it("creates fetch specs and update groups with safe defaults", () => {
    const gauge = widgetRegistry.numberGauge.createState("w-g", 1, 1);
    const spec = widgetRegistry.numberGauge.getFetchSpec(gauge.config);
    expect(spec).toMatchObject({
      enabled: true,
      endpoint: gauge.config.apiEndpoint,
      field: gauge.config.field
    });

    const updateGroup = widgetRegistry.numberGauge.getUpdateGroup({
      ...gauge.config,
      updateGroup: "   "
    });
    expect(updateGroup).toBe("");
  });

  it("normalizes and clamps widget geometry through registry adapters", () => {
    const spark = widgetRegistry.sparklineChart.createState("w-spark", 50, 50);
    const clamped = widgetRegistry.sparklineChart.clampToGrid(spark, 12, 8, 2);
    expect(clamped.colStart).toBeGreaterThanOrEqual(1);
    expect(clamped.rowStart).toBeGreaterThanOrEqual(1);
    expect(clamped.colSpan).toBeLessThanOrEqual(12);
    expect(clamped.rowSpan).toBeLessThanOrEqual(8);

    const normalized = widgetRegistry.sparklineChart.normalizeConfig(clamped);
    expect(normalized).toHaveProperty("format");
    expect(normalized).toHaveProperty("showFill");
  });
});

