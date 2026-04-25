import { cleanup, fireEvent, render, screen, within } from "@solidjs/testing-library";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DonutConfig } from "../../widgets/donutWidget";
import { DonutSettingsForm } from "./DonutSettingsForm";

afterEach(() => {
  cleanup();
});

function createDonutConfig(): DonutConfig {
  return {
    label: "Utilization",
    align: "center",
    ringWidth: 13,
    min: 0,
    max: 100,
    decimals: 1,
    format: "compact",
    defaultValue: "45",
    seriesLabelField: "label",
    seriesValueField: "value",
    updateGroup: "group-a",
    apiEndpoint: "https://api.example.com/donut",
    field: "value"
  };
}

describe("DonutSettingsForm", () => {
  it("renders base settings, format controls, width slider and api section", () => {
    render(() => (
      <DonutSettingsForm
        config={createDonutConfig()}
        dashboardUpdateGroups={["group-a", "group-b"]}
        onPatch={vi.fn()}
        baseSettings={<div data-testid="base-settings">Base Settings</div>}
      />
    ));

    expect(screen.getByTestId("base-settings")).toBeInTheDocument();
    expect(screen.getByRole("radiogroup", { name: "Donut format" })).toBeInTheDocument();
    expect(screen.getByRole("radiogroup", { name: "Donut decimals" })).toBeInTheDocument();
    expect(screen.getByRole("slider")).toHaveValue("13");
    expect(screen.getByText("API Settings")).toBeInTheDocument();
  });

  it("emits patches for format/decimals/width and api fields", async () => {
    const onPatch = vi.fn();
    const view = render(() => (
      <DonutSettingsForm
        config={createDonutConfig()}
        dashboardUpdateGroups={["group-a", "group-b"]}
        onPatch={onPatch}
        baseSettings={<div>Base Settings</div>}
      />
    ));

    await fireEvent.click(
      within(screen.getByRole("radiogroup", { name: "Donut format" })).getByRole("radio", {
        name: "Full"
      })
    );
    await fireEvent.click(
      within(screen.getByRole("radiogroup", { name: "Donut decimals" })).getByRole("radio", {
        name: "3"
      })
    );
    await fireEvent.input(screen.getByRole("slider"), { target: { value: "18" } });

    const combos = within(view.container).getAllByRole("combobox");
    await fireEvent.input(combos[0]!, { target: { value: "https://api.example.com/new" } });
    await fireEvent.input(combos[1]!, { target: { value: "group-b" } });

    expect(onPatch).toHaveBeenCalledWith({ format: "full" });
    expect(onPatch).toHaveBeenCalledWith({ decimals: 3 });
    expect(onPatch).toHaveBeenCalledWith({ ringWidth: 18 });
    expect(onPatch).toHaveBeenCalledWith({ apiEndpoint: "https://api.example.com/new" });
    expect(onPatch).toHaveBeenCalledWith({ updateGroup: "group-b" });
  });
});

