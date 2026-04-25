import { cleanup, fireEvent, render, screen, within } from "@solidjs/testing-library";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SparklineConfig } from "../../widgets/sparklineWidget";
import { SparklineSettingsForm } from "./SparklineSettingsForm";

afterEach(() => {
  cleanup();
});

function createSparklineConfig(): SparklineConfig {
  return {
    label: "Latency",
    align: "left",
    min: 0,
    max: 100,
    format: "compact",
    decimals: 1,
    defaultValue: "42",
    seriesLabelField: "label",
    seriesValueField: "value",
    strokeWidth: 2.5,
    showFill: true,
    updateGroup: "group-a",
    apiEndpoint: "https://api.example.com/sparkline",
    field: "value"
  };
}

describe("SparklineSettingsForm", () => {
  it("renders sparkline controls and api section", () => {
    render(() => (
      <SparklineSettingsForm
        config={createSparklineConfig()}
        dashboardUpdateGroups={["group-a", "group-b"]}
        onPatch={vi.fn()}
        baseSettings={<div data-testid="base-settings">Base Settings</div>}
      />
    ));

    expect(screen.getByTestId("base-settings")).toBeInTheDocument();
    expect(screen.getByRole("radiogroup", { name: "Sparkline format" })).toBeInTheDocument();
    expect(screen.getByRole("radiogroup", { name: "Sparkline decimals" })).toBeInTheDocument();
    expect(screen.getByRole("radiogroup", { name: "Sparkline area fill" })).toBeInTheDocument();
    expect(screen.getByRole("slider")).toHaveValue("2.5");
    expect(screen.getAllByPlaceholderText("Dynamic")).toHaveLength(2);
  });

  it("emits patches for sparkline form interactions", async () => {
    const onPatch = vi.fn();
    const view = render(() => (
      <SparklineSettingsForm
        config={createSparklineConfig()}
        dashboardUpdateGroups={["group-a", "group-b"]}
        onPatch={onPatch}
        baseSettings={<div>Base Settings</div>}
      />
    ));

    await fireEvent.click(
      within(screen.getByRole("radiogroup", { name: "Sparkline format" })).getByRole("radio", {
        name: "Full"
      })
    );
    await fireEvent.click(
      within(screen.getByRole("radiogroup", { name: "Sparkline decimals" })).getByRole("radio", {
        name: "3"
      })
    );
    await fireEvent.click(
      within(screen.getByRole("radiogroup", { name: "Sparkline area fill" })).getByRole("radio", {
        name: "Off"
      })
    );
    await fireEvent.input(screen.getByRole("slider"), { target: { value: "4" } });

    const numberInputs = within(view.container).getAllByRole("spinbutton");
    await fireEvent.input(numberInputs[0]!, { target: { value: "10" } });
    await fireEvent.input(numberInputs[1]!, { target: { value: "200" } });

    const combos = within(view.container).getAllByRole("combobox");
    await fireEvent.input(combos[0]!, { target: { value: "https://api.example.com/new" } });
    await fireEvent.input(combos[1]!, { target: { value: "group-b" } });

    expect(onPatch).toHaveBeenCalledWith({ format: "full" });
    expect(onPatch).toHaveBeenCalledWith({ decimals: 3 });
    expect(onPatch).toHaveBeenCalledWith({ showFill: false });
    expect(onPatch).toHaveBeenCalledWith({ strokeWidth: 4 });
    expect(onPatch).toHaveBeenCalledWith({ min: 10 });
    expect(onPatch).toHaveBeenCalledWith({ max: 200 });
    expect(onPatch).toHaveBeenCalledWith({ apiEndpoint: "https://api.example.com/new" });
    expect(onPatch).toHaveBeenCalledWith({ updateGroup: "group-b" });
  });
});

