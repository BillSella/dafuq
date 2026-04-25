import { cleanup, fireEvent, render, screen, within } from "@solidjs/testing-library";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { GaugeConfig } from "../../widgets/gaugeWidget";
import { NumberGaugeSettingsForm } from "./NumberGaugeSettingsForm";

afterEach(() => {
  cleanup();
});

function createGaugeConfig(): GaugeConfig {
  return {
    label: "Primary Sensor",
    fontSize: "medium",
    align: "center",
    defaultValue: "123.4",
    updateGroup: "group-a",
    format: "full",
    decimalPlaces: 1,
    apiEndpoint: "https://api.example.com/sensor",
    field: "value"
  };
}

describe("NumberGaugeSettingsForm", () => {
  it("renders base settings and shared sections", () => {
    render(() => (
      <NumberGaugeSettingsForm
        config={createGaugeConfig()}
        dashboardUpdateGroups={["group-a", "group-b"]}
        onPatch={vi.fn()}
        baseSettings={<div data-testid="base-settings">Base Settings</div>}
      />
    ));

    expect(screen.getByTestId("base-settings")).toBeInTheDocument();
    expect(screen.getByRole("radiogroup", { name: "Number format" })).toBeInTheDocument();
    expect(screen.getByRole("radiogroup", { name: "Decimal places" })).toBeInTheDocument();
    expect(screen.getByText("API Settings")).toBeInTheDocument();
  });

  it("emits patches for format/decimals and API connection fields", async () => {
    const onPatch = vi.fn();
    const view = render(() => (
      <NumberGaugeSettingsForm
        config={createGaugeConfig()}
        dashboardUpdateGroups={["group-a", "group-b"]}
        onPatch={onPatch}
        baseSettings={<div>Base Settings</div>}
      />
    ));

    await fireEvent.click(within(screen.getByRole("radiogroup", { name: "Number format" })).getByRole("radio", { name: "Compact" }));
    await fireEvent.click(within(screen.getByRole("radiogroup", { name: "Decimal places" })).getByRole("radio", { name: "3" }));

    const combos = within(view.container).getAllByRole("combobox");
    await fireEvent.input(combos[0]!, { target: { value: "https://api.example.com/new" } });
    await fireEvent.input(combos[1]!, { target: { value: "group-b" } });

    expect(onPatch).toHaveBeenCalledWith({ format: "compact" });
    expect(onPatch).toHaveBeenCalledWith({ decimalPlaces: 3 });
    expect(onPatch).toHaveBeenCalledWith({ apiEndpoint: "https://api.example.com/new" });
    expect(onPatch).toHaveBeenCalledWith({ updateGroup: "group-b" });
  });
});

