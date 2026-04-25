import { cleanup, fireEvent, render, screen, within } from "@solidjs/testing-library";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { BarConfig } from "../../widgets/barWidget";
import { BarSettingsForm } from "./BarSettingsForm";

afterEach(() => {
  cleanup();
});

function createBarConfig(): BarConfig {
  return {
    label: "Throughput",
    align: "left",
    orientation: "horizontal",
    min: 0,
    max: 100,
    format: "compact",
    decimals: 1,
    defaultValue: "12",
    seriesLabelField: "label",
    seriesValueField: "value",
    updateGroup: "group-a",
    apiEndpoint: "https://api.example.com/bar",
    field: "value"
  };
}

describe("BarSettingsForm", () => {
  it("renders chart type, format/decimals, min/max and api settings", () => {
    render(() => (
      <BarSettingsForm
        config={createBarConfig()}
        dashboardUpdateGroups={["group-a", "group-b"]}
        onPatch={vi.fn()}
        baseSettings={<div data-testid="base-settings">Base Settings</div>}
      />
    ));

    expect(screen.getByTestId("base-settings")).toBeInTheDocument();
    expect(screen.getByRole("radiogroup", { name: "Bar chart type" })).toBeInTheDocument();
    expect(screen.getByRole("radiogroup", { name: "Bar format" })).toBeInTheDocument();
    expect(screen.getByRole("radiogroup", { name: "Bar decimals" })).toBeInTheDocument();
    expect(screen.getAllByPlaceholderText("Dynamic")).toHaveLength(2);
    expect(screen.getByText("API Settings")).toBeInTheDocument();
  });

  it("emits patches for orientation, formatting, ranges, and api fields", async () => {
    const onPatch = vi.fn();
    const view = render(() => (
      <BarSettingsForm
        config={createBarConfig()}
        dashboardUpdateGroups={["group-a", "group-b"]}
        onPatch={onPatch}
        baseSettings={<div>Base Settings</div>}
      />
    ));

    await fireEvent.click(
      within(screen.getByRole("radiogroup", { name: "Bar chart type" })).getByRole("radio", {
        name: "Column"
      })
    );
    await fireEvent.click(
      within(screen.getByRole("radiogroup", { name: "Bar format" })).getByRole("radio", {
        name: "Full"
      })
    );
    await fireEvent.click(
      within(screen.getByRole("radiogroup", { name: "Bar decimals" })).getByRole("radio", {
        name: "3"
      })
    );

    const numberInputs = within(view.container).getAllByRole("spinbutton");
    await fireEvent.input(numberInputs[0]!, { target: { value: "25" } });
    await fireEvent.input(numberInputs[1]!, { target: { value: "250" } });

    const combos = within(view.container).getAllByRole("combobox");
    await fireEvent.input(combos[0]!, { target: { value: "https://api.example.com/new" } });
    await fireEvent.input(combos[1]!, { target: { value: "group-b" } });

    expect(onPatch).toHaveBeenCalledWith({ orientation: "vertical" });
    expect(onPatch).toHaveBeenCalledWith({ format: "full" });
    expect(onPatch).toHaveBeenCalledWith({ decimals: 3 });
    expect(onPatch).toHaveBeenCalledWith({ min: 25 });
    expect(onPatch).toHaveBeenCalledWith({ max: 250 });
    expect(onPatch).toHaveBeenCalledWith({ apiEndpoint: "https://api.example.com/new" });
    expect(onPatch).toHaveBeenCalledWith({ updateGroup: "group-b" });
  });
});

