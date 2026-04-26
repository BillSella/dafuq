import { cleanup, fireEvent, render, screen, within } from "@solidjs/testing-library";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DashboardBreakpoint, DashboardWidgetDoc } from "../../modules/dashboard/dashboardStore";
import { widgetRegistry } from "../../widgets/widgetRegistry";
import { WidgetVisibilityField } from "./WidgetVisibilityField";

const options: { id: DashboardBreakpoint; label: string }[] = [
  { id: "desktopFhd", label: "Desktop" },
  { id: "mobilePortrait", label: "Mobile" }
];

function createWidgetDoc(): DashboardWidgetDoc {
  const state = widgetRegistry.numberGauge.createState("widget-1", 2, 2);
  return {
    id: state.id,
    type: state.type,
    config: state.config,
    placements: [
      { breakpoint: "desktopFhd", colStart: 2, rowStart: 2, colSpan: 4, rowSpan: 4, visible: true },
      {
        breakpoint: "mobilePortrait",
        colStart: 1,
        rowStart: 1,
        colSpan: 4,
        rowSpan: 4,
        visible: false
      }
    ],
    display: [
      {
        breakpoint: "desktopFhd",
        ...widgetRegistry.numberGauge.getDisplayConfigFromConfig(state.config)
      },
      {
        breakpoint: "mobilePortrait",
        ...widgetRegistry.numberGauge.getDisplayConfigFromConfig(state.config)
      }
    ]
  };
}

afterEach(() => {
  cleanup();
});

describe("WidgetVisibilityField", () => {
  it("shows enabled ratio based on placement visibility", () => {
    const view = render(() => (
      <WidgetVisibilityField
        widgetDoc={createWidgetDoc()}
        options={options}
        open={false}
        onToggleOpen={vi.fn()}
        onChange={vi.fn()}
      />
    ));

    expect(within(view.container).getByText("1 / 2 enabled")).toBeInTheDocument();
  });

  it("routes menu and checkbox interactions through callbacks", async () => {
    const onToggleOpen = vi.fn();
    const onChange = vi.fn();
    const view = render(() => (
      <WidgetVisibilityField
        widgetDoc={createWidgetDoc()}
        options={options}
        open={true}
        onToggleOpen={onToggleOpen}
        onChange={onChange}
      />
    ));

    const scoped = within(view.container);
    await fireEvent.click(scoped.getByRole("button"));
    expect(onToggleOpen).toHaveBeenCalledTimes(1);

    await fireEvent.click(scoped.getByRole("checkbox", { name: "Mobile" }));
    expect(onChange).toHaveBeenCalledWith("mobilePortrait", true);
  });
});

