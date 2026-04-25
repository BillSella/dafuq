import { cleanup, fireEvent, render, screen, within } from "@solidjs/testing-library";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TimeSeriesConfig } from "../../widgets/timeSeriesWidget";
import { TimeSeriesSettingsForm } from "./TimeSeriesSettingsForm";

afterEach(() => {
  cleanup();
});

function createTimeSeriesConfig(): TimeSeriesConfig {
  return {
    label: "Requests / min",
    align: "left",
    min: 0,
    max: 12,
    format: "compact",
    decimals: 1,
    defaultValue: "[]",
    seriesLabelField: "t",
    seriesValueField: "a",
    seriesValueFields: "a, b",
    strokeWidth: 2.2,
    showFill: true,
    showGrid: true,
    stacked: false,
    updateGroup: "group-a",
    apiEndpoint: "https://api.example.com/timeseries",
    field: "value"
  };
}

describe("TimeSeriesSettingsForm", () => {
  it("renders timeseries toggles, ranges, and api settings", () => {
    render(() => (
      <TimeSeriesSettingsForm
        config={createTimeSeriesConfig()}
        dashboardUpdateGroups={["group-a", "group-b"]}
        onPatch={vi.fn()}
        baseSettings={<div data-testid="base-settings">Base Settings</div>}
      />
    ));

    expect(screen.getByTestId("base-settings")).toBeInTheDocument();
    expect(screen.getByRole("radiogroup", { name: "Time series value format" })).toBeInTheDocument();
    expect(screen.getByRole("radiogroup", { name: "Time series decimals" })).toBeInTheDocument();
    expect(screen.getByRole("radiogroup", { name: "Time series stacked" })).toBeInTheDocument();
    expect(screen.getByRole("radiogroup", { name: "Time series area fill" })).toBeInTheDocument();
    expect(screen.getByRole("radiogroup", { name: "Time series grid" })).toBeInTheDocument();
    expect(screen.getByRole("slider")).toHaveValue("2.2");
  });

  it("emits patches for time-series interactions", async () => {
    const onPatch = vi.fn();
    const view = render(() => (
      <TimeSeriesSettingsForm
        config={createTimeSeriesConfig()}
        dashboardUpdateGroups={["group-a", "group-b"]}
        onPatch={onPatch}
        baseSettings={<div>Base Settings</div>}
      />
    ));

    await fireEvent.click(
      within(screen.getByRole("radiogroup", { name: "Time series value format" })).getByRole(
        "radio",
        { name: "Full" }
      )
    );
    await fireEvent.click(
      within(screen.getByRole("radiogroup", { name: "Time series decimals" })).getByRole("radio", {
        name: "3"
      })
    );
    await fireEvent.click(
      within(screen.getByRole("radiogroup", { name: "Time series stacked" })).getByRole("radio", {
        name: "On"
      })
    );
    await fireEvent.click(
      within(screen.getByRole("radiogroup", { name: "Time series area fill" })).getByRole("radio", {
        name: "Off"
      })
    );
    await fireEvent.click(
      within(screen.getByRole("radiogroup", { name: "Time series grid" })).getByRole("radio", {
        name: "Off"
      })
    );
    await fireEvent.input(screen.getByRole("slider"), { target: { value: "4" } });

    const numberInputs = within(view.container).getAllByRole("spinbutton");
    await fireEvent.input(numberInputs[0]!, { target: { value: "2" } });
    await fireEvent.input(numberInputs[1]!, { target: { value: "24" } });

    const combos = within(view.container).getAllByRole("combobox");
    await fireEvent.input(combos[0]!, { target: { value: "https://api.example.com/new" } });
    await fireEvent.input(combos[1]!, { target: { value: "group-b" } });

    expect(onPatch).toHaveBeenCalledWith({ format: "full" });
    expect(onPatch).toHaveBeenCalledWith({ decimals: 3 });
    expect(onPatch).toHaveBeenCalledWith({ stacked: true });
    expect(onPatch).toHaveBeenCalledWith({ showFill: false });
    expect(onPatch).toHaveBeenCalledWith({ showGrid: false });
    expect(onPatch).toHaveBeenCalledWith({ strokeWidth: 4 });
    expect(onPatch).toHaveBeenCalledWith({ min: 2 });
    expect(onPatch).toHaveBeenCalledWith({ max: 24 });
    expect(onPatch).toHaveBeenCalledWith({ apiEndpoint: "https://api.example.com/new" });
    expect(onPatch).toHaveBeenCalledWith({ updateGroup: "group-b" });
  });
});

