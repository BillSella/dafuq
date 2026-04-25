import { cleanup, fireEvent, render, screen, within } from "@solidjs/testing-library";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MapConfig } from "../../widgets/mapWidget";
import { MapSettingsForm } from "./MapSettingsForm";

afterEach(() => {
  cleanup();
});

function createMapConfig(): MapConfig {
  return {
    label: "Map",
    align: "left",
    mapRegion: "world",
    min: 0,
    max: 1000,
    dotRadiusMin: 2.2,
    dotRadiusMax: 9.5,
    format: "compact",
    decimals: 0,
    lineBend: 0.14,
    defaultValue: "{}",
    updateGroup: "group-a",
    apiEndpoint: "https://api.example.com/map",
    field: "value"
  };
}

describe("MapSettingsForm", () => {
  it("renders map region, curve controls, and api settings", () => {
    render(() => (
      <MapSettingsForm
        config={createMapConfig()}
        dashboardUpdateGroups={["group-a", "group-b"]}
        onPatch={vi.fn()}
        baseSettings={<div data-testid="base-settings">Base Settings</div>}
      />
    ));

    expect(screen.getByTestId("base-settings")).toBeInTheDocument();
    expect(screen.getByRole("radiogroup", { name: "Map basemap" })).toBeInTheDocument();
    expect(screen.getByRole("slider")).toHaveValue("0.14");
    expect(screen.getByText("API Settings")).toBeInTheDocument();
  });

  it("emits patches for map region, curve, and api fields", async () => {
    const onPatch = vi.fn();
    const view = render(() => (
      <MapSettingsForm
        config={createMapConfig()}
        dashboardUpdateGroups={["group-a", "group-b"]}
        onPatch={onPatch}
        baseSettings={<div>Base Settings</div>}
      />
    ));

    await fireEvent.click(
      within(screen.getByRole("radiogroup", { name: "Map basemap" })).getByRole("radio", {
        name: "USA"
      })
    );
    await fireEvent.input(screen.getByRole("slider"), { target: { value: "0.20" } });

    const combos = within(view.container).getAllByRole("combobox");
    await fireEvent.input(combos[0]!, { target: { value: "https://api.example.com/new" } });
    await fireEvent.input(combos[1]!, { target: { value: "group-b" } });

    expect(onPatch).toHaveBeenCalledWith({ mapRegion: "usa" });
    expect(onPatch).toHaveBeenCalledWith({ lineBend: 0.2 });
    expect(onPatch).toHaveBeenCalledWith({ apiEndpoint: "https://api.example.com/new" });
    expect(onPatch).toHaveBeenCalledWith({ updateGroup: "group-b" });
  });
});

