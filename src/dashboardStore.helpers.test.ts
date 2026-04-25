import { describe, expect, it } from "vitest";
import {
  getWidgetDisplayConfig,
  getWidgetPlacement,
  makeDashboardStorageKey,
  upsertWidgetDisplayConfig,
  upsertWidgetPlacement,
  type DashboardWidgetDoc
} from "./dashboardStore";
import { widgetRegistry } from "./widgets/widgetRegistry";

function createWidgetDoc(): DashboardWidgetDoc {
  const state = widgetRegistry.numberGauge.createState("w-1", 2, 3);
  return {
    id: state.id,
    type: state.type,
    config: state.config,
    placements: [
      {
        breakpoint: "desktopFhd",
        colStart: 2,
        rowStart: 3,
        colSpan: 4,
        rowSpan: 5,
        visible: true
      }
    ],
    display: [
      {
        breakpoint: "desktopFhd",
        ...widgetRegistry.numberGauge.getDisplayConfigFromConfig(state.config)
      }
    ]
  };
}

describe("dashboardStore helpers", () => {
  it("builds dashboard storage keys", () => {
    expect(makeDashboardStorageKey("abc")).toBe("dashboard:abc.json");
  });

  it("returns breakpoint placement or safe fallback", () => {
    const widget = createWidgetDoc();
    expect(getWidgetPlacement(widget, "desktopFhd")).toMatchObject({
      breakpoint: "desktopFhd",
      colStart: 2,
      rowStart: 3
    });

    const fallback = getWidgetPlacement(widget, "mobilePortrait");
    expect(fallback).toMatchObject({
      breakpoint: "desktopFhd",
      colStart: 2,
      rowStart: 3,
      visible: true
    });

    const emptyWidget = { ...widget, placements: [] };
    const generated = getWidgetPlacement(emptyWidget, "mobilePortrait");
    expect(generated).toMatchObject({
      breakpoint: "mobilePortrait",
      colStart: 1,
      rowStart: 1,
      colSpan: 16,
      rowSpan: 16,
      visible: true
    });
  });

  it("upserts placement by appending or replacing", () => {
    const widget = createWidgetDoc();
    const added = upsertWidgetPlacement(widget, "mobilePortrait", {
      breakpoint: "mobilePortrait",
      colStart: 1,
      rowStart: 1,
      colSpan: 2,
      rowSpan: 2,
      visible: true
    });
    expect(added).toHaveLength(2);

    const replaced = upsertWidgetPlacement(widget, "desktopFhd", {
      breakpoint: "desktopFhd",
      colStart: 9,
      rowStart: 9,
      colSpan: 2,
      rowSpan: 2,
      visible: false
    });
    expect(replaced).toHaveLength(1);
    expect(replaced[0]).toMatchObject({ colStart: 9, visible: false });
  });

  it("reads display config and falls back to registry defaults", () => {
    const widget = createWidgetDoc();
    const exact = getWidgetDisplayConfig(widget, "desktopFhd");
    const { breakpoint: _ignoreBreakpoint, ...expectedDisplay } = widget.display[0]!;
    expect(exact).toMatchObject(expectedDisplay);

    const fallback = getWidgetDisplayConfig({ ...widget, display: [] }, "mobilePortrait");
    expect(fallback).toMatchObject(
      widgetRegistry.numberGauge.getDisplayConfigFromConfig(widget.config)
    );
  });

  it("upserts display config by appending or replacing", () => {
    const widget = createWidgetDoc();
    const { breakpoint: _ignoredBreakpoint, ...baseDisplay } = widget.display[0]!;
    const appended = upsertWidgetDisplayConfig(widget, "mobilePortrait", {
      ...baseDisplay,
      label: "Mobile Label"
    });
    expect(appended).toHaveLength(2);
    expect(appended[1]).toMatchObject({ breakpoint: "mobilePortrait", label: "Mobile Label" });

    const replaced = upsertWidgetDisplayConfig(widget, "desktopFhd", {
      ...baseDisplay,
      label: "Desktop Label"
    });
    expect(replaced).toHaveLength(1);
    expect(replaced[0]).toMatchObject({ breakpoint: "desktopFhd", label: "Desktop Label" });
  });
});

