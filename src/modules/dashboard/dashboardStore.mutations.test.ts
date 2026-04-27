import { describe, expect, it, vi } from "vitest";
import {
  createDashboardDoc,
  deleteWidgetInDashboards,
  ensureWidgetsFitGridInDashboards,
  normalizeDashboardDoc,
  type DashboardBreakpoint,
  type DashboardDoc,
  type DashboardWidgetDoc,
  updateWidgetConfigInDashboards,
  updateWidgetInDashboards,
  updateWidgetVisibilityInDashboards
} from "./dashboardStore";
import { widgetRegistry } from "../../widgets/widgetRegistry";

const BREAKPOINTS: DashboardBreakpoint[] = [
  "mobilePortrait",
  "mobileLandscape",
  "tabletPortrait",
  "tabletLandscape",
  "laptopWxga",
  "desktopFhd",
  "qhd2k",
  "uhd4k",
  "uhd8k"
];

function createWidget(id = "widget-1"): DashboardWidgetDoc {
  const state = widgetRegistry.numberGauge.createState(id, 2, 3);
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

function createDashboards(): DashboardDoc[] {
  return [
    {
      id: "dash-1",
      name: "Primary",
      updateFrequencySeconds: 60,
      enabledBreakpoints: Object.fromEntries(BREAKPOINTS.map((bp) => [bp, true])) as Record<
        DashboardBreakpoint,
        boolean
      >,
      extraGridRows: Object.fromEntries(BREAKPOINTS.map((bp) => [bp, 0])) as Record<
        DashboardBreakpoint,
        number
      >,
      widgets: [createWidget("widget-1"), createWidget("widget-2")]
    },
    {
      id: "dash-2",
      name: "Secondary",
      updateFrequencySeconds: 60,
      enabledBreakpoints: Object.fromEntries(BREAKPOINTS.map((bp) => [bp, true])) as Record<
        DashboardBreakpoint,
        boolean
      >,
      extraGridRows: Object.fromEntries(BREAKPOINTS.map((bp) => [bp, 0])) as Record<
        DashboardBreakpoint,
        number
      >,
      widgets: [createWidget("widget-3")]
    }
  ];
}

describe("dashboardStore mutations", () => {
  it("creates dashboards with optional default widget", () => {
    const randomUuid = vi.spyOn(globalThis.crypto, "randomUUID");
    randomUuid
      .mockReturnValueOnce("11111111-1111-1111-1111-111111111111")
      .mockReturnValueOnce("22222222-2222-2222-2222-222222222222");

    const withWidget = createDashboardDoc("Ops", true, BREAKPOINTS);
    expect(withWidget.id).toBe("dashboard-11111111-1111-1111-1111-111111111111");
    expect(withWidget.widgets).toHaveLength(1);
    expect(withWidget.widgets[0]!.id).toBe("widget-22222222-2222-2222-2222-222222222222");
    expect(withWidget.widgets[0]!.placements).toHaveLength(BREAKPOINTS.length);
    expect(withWidget.widgets[0]!.display).toHaveLength(BREAKPOINTS.length);

    randomUuid.mockRestore();

    const withoutWidget = createDashboardDoc("Ops", false, BREAKPOINTS);
    expect(withoutWidget.widgets).toHaveLength(0);
  });

  it("normalizes legacy breakpoints and fills missing widget data", () => {
    const legacyDoc = {
      id: "dash-legacy",
      name: "Legacy",
      updateFrequencySeconds: 9999,
      enabledBreakpoints: { desktop: true, phonePortrait: false, unknown: true },
      extraGridRows: { desktop: 3.8, phoneLandscape: -2, bad: "x" },
      widgets: [
        {
          ...createWidget("legacy-widget"),
          placements: [
            {
              breakpoint: "desktop" as unknown as DashboardBreakpoint,
              colStart: 4,
              rowStart: 5,
              colSpan: 6,
              rowSpan: 7,
              visible: undefined as unknown as boolean
            }
          ],
          display: [
            {
              breakpoint: "desktop" as unknown as DashboardBreakpoint,
              label: "Legacy Label"
            }
          ]
        }
      ]
    } as unknown as DashboardDoc;

    const normalized = normalizeDashboardDoc(legacyDoc, BREAKPOINTS);
    expect(normalized.updateFrequencySeconds).toBe(900);
    expect(normalized.enabledBreakpoints.mobilePortrait).toBe(true);
    expect(normalized.enabledBreakpoints.desktopFhd).toBe(true);
    expect(normalized.extraGridRows.desktopFhd).toBe(3);
    expect(normalized.extraGridRows.mobileLandscape).toBe(0);
    expect(normalized.widgets[0]!.placements).toHaveLength(BREAKPOINTS.length);
    expect(normalized.widgets[0]!.display).toHaveLength(BREAKPOINTS.length);
  });

  it("updates a widget placement immutably in the target dashboard", () => {
    const dashboards = createDashboards();
    const updated = updateWidgetInDashboards(
      dashboards,
      "dash-1",
      "desktopFhd",
      "widget-1",
      { colStart: 9, rowStart: 10 }
    );

    expect(updated[0]!.widgets[0]!.placements[0]).toMatchObject({ colStart: 9, rowStart: 10 });
    expect(updated[1]).toBe(dashboards[1]);
    expect(updated[0]!.widgets[1]).toBe(dashboards[0]!.widgets[1]);
  });

  it("updates widget config using display and global patch paths", () => {
    const dashboards = createDashboards();
    const updated = updateWidgetConfigInDashboards(
      dashboards,
      "dash-1",
      "desktopFhd",
      "widget-1",
      {
        label: "Renamed",
        apiEndpoint: "https://example.com/new",
        defaultValue: "42"
      }
    );

    const widget = updated[0]!.widgets[0]!;
    expect(widget.type).toBe("numberGauge");
    const gaugeConfig = widget.config as import("../../widgets/gaugeWidget").GaugeConfig;
    expect(widget.config.apiEndpoint).toBe("https://example.com/new");
    expect(gaugeConfig.defaultValue).toBe("42");
    expect(widget.display[0]).toMatchObject({ breakpoint: "desktopFhd", label: "Renamed" });
  });

  it("updates visibility and deletes widgets on target dashboard only", () => {
    const dashboards = createDashboards();
    const visibilityUpdated = updateWidgetVisibilityInDashboards(
      dashboards,
      "dash-1",
      "widget-1",
      "desktopFhd",
      false
    );
    expect(visibilityUpdated[0]!.widgets[0]!.placements[0]!.visible).toBe(false);
    expect(visibilityUpdated[1]).toBe(dashboards[1]);

    const deleted = deleteWidgetInDashboards(visibilityUpdated, "dash-1", "widget-2");
    expect(deleted[0]!.widgets.map((w) => w.id)).toEqual(["widget-1"]);
    expect(deleted[1]).toBe(visibilityUpdated[1]);
  });

  it("clamps widgets to fit resized grid bounds", () => {
    const dashboards = createDashboards();
    dashboards[0]!.widgets[0]!.placements[0] = {
      breakpoint: "desktopFhd",
      colStart: 100,
      rowStart: 100,
      colSpan: 99,
      rowSpan: 99,
      visible: true
    };

    const updated = ensureWidgetsFitGridInDashboards(
      dashboards,
      "dash-1",
      "desktopFhd",
      12,
      8,
      2
    );
    const placement = updated[0]!.widgets[0]!.placements.find((p) => p.breakpoint === "desktopFhd")!;
    expect(placement.colStart).toBeGreaterThanOrEqual(1);
    expect(placement.colStart).toBeLessThanOrEqual(12);
    expect(placement.rowStart).toBeGreaterThanOrEqual(1);
    expect(placement.rowStart).toBeLessThanOrEqual(8);
    expect(placement.colSpan).toBeLessThanOrEqual(12);
    expect(placement.rowSpan).toBeLessThanOrEqual(8);
  });
});
