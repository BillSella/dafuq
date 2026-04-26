import { cleanup, fireEvent, render, screen } from "@solidjs/testing-library";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DashboardBreakpoint, DashboardWidgetDoc } from "../../modules/dashboard/dashboardStore";
import { widgetRegistry } from "../../widgets/widgetRegistry";
import { BaseWidgetSettingsSection } from "./BaseWidgetSettingsSection";

afterEach(() => {
  cleanup();
});

const breakpoints: { id: DashboardBreakpoint; label: string }[] = [
  { id: "desktopFhd", label: "Desktop" },
  { id: "mobilePortrait", label: "Mobile" }
];

function createWidgetDoc(): DashboardWidgetDoc {
  const state = widgetRegistry.numberGauge.createState("widget-a", 2, 2);
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

describe("BaseWidgetSettingsSection", () => {
  it("renders shared display controls", () => {
    const view = render(() => (
      <BaseWidgetSettingsSection
        widgetDoc={createWidgetDoc()}
        breakpointOptions={breakpoints}
        visibilityOpen={false}
        visibilityMenuRef={() => undefined}
        visibilityButtonRef={() => undefined}
        onToggleVisibilityOpen={vi.fn()}
        onVisibilityChange={vi.fn()}
        label="Primary Flow"
        onLabelChange={vi.fn()}
        align="center"
        onAlignChange={vi.fn()}
        fontSize="medium"
        onFontSizeChange={vi.fn()}
      />
    ));

    expect(screen.getByText("Display Settings")).toBeInTheDocument();
    expect(view.container).toHaveTextContent("1 / 2 enabled");
    expect(screen.getByDisplayValue("Primary Flow")).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toHaveValue("medium");
    expect(screen.getByRole("radio", { name: "Center" })).toHaveAttribute("aria-checked", "true");
  });

  it("routes visibility, label, font size, and align callbacks", async () => {
    const onToggleVisibilityOpen = vi.fn();
    const onVisibilityChange = vi.fn();
    const onLabelChange = vi.fn();
    const onAlignChange = vi.fn();
    const onFontSizeChange = vi.fn();

    const view = render(() => (
      <BaseWidgetSettingsSection
        widgetDoc={createWidgetDoc()}
        breakpointOptions={breakpoints}
        visibilityOpen={true}
        visibilityMenuRef={() => undefined}
        visibilityButtonRef={() => undefined}
        onToggleVisibilityOpen={onToggleVisibilityOpen}
        onVisibilityChange={onVisibilityChange}
        label="Primary Flow"
        onLabelChange={onLabelChange}
        align="left"
        onAlignChange={onAlignChange}
        fontSize="small"
        onFontSizeChange={onFontSizeChange}
      />
    ));

    const visibilityButton = view.container.querySelector(
      ".visibility-toggle"
    ) as HTMLButtonElement | null;
    expect(visibilityButton).toBeInTheDocument();

    await fireEvent.click(visibilityButton!);
    await fireEvent.click(screen.getByRole("checkbox", { name: "Mobile" }));
    await fireEvent.input(screen.getByDisplayValue("Primary Flow"), {
      target: { value: "Renamed Widget" }
    });
    await fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "large" }
    });
    await fireEvent.click(screen.getByRole("radio", { name: "Right" }));

    expect(onToggleVisibilityOpen).toHaveBeenCalledTimes(1);
    expect(onVisibilityChange).toHaveBeenCalledWith("mobilePortrait", true);
    expect(onLabelChange).toHaveBeenCalledWith("Renamed Widget");
    expect(onFontSizeChange).toHaveBeenCalledWith("large");
    expect(onAlignChange).toHaveBeenCalledWith("right");
  });
});

