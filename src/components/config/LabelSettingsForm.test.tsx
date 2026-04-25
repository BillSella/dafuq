import { cleanup, fireEvent, render, screen, within } from "@solidjs/testing-library";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { LabelConfig } from "../../widgets/labelWidget";
import { LabelSettingsForm } from "./LabelSettingsForm";

afterEach(() => {
  cleanup();
});

function createLabelConfig(): LabelConfig {
  return {
    sourceMode: "static",
    align: "center",
    staticText: "Label Text",
    apiEndpoint: "https://api.example.com/labels",
    field: "label",
    fallbackText: "No Data",
    updateGroup: "group-a"
  };
}

describe("LabelSettingsForm", () => {
  it("renders base settings, source selector, and API settings", () => {
    render(() => (
      <LabelSettingsForm
        config={createLabelConfig()}
        dashboardUpdateGroups={["group-a", "group-b"]}
        onPatch={vi.fn()}
        baseSettings={<div data-testid="base-settings">Base Settings</div>}
      />
    ));

    expect(screen.getByTestId("base-settings")).toBeInTheDocument();
    expect(screen.getByRole("radiogroup", { name: "Label source" })).toBeInTheDocument();
    expect(screen.getByText("API Settings")).toBeInTheDocument();
  });

  it("emits patches for source mode and API connection fields", async () => {
    const onPatch = vi.fn();
    const view = render(() => (
      <LabelSettingsForm
        config={createLabelConfig()}
        dashboardUpdateGroups={["group-a", "group-b"]}
        onPatch={onPatch}
        baseSettings={<div>Base Settings</div>}
      />
    ));

    await fireEvent.click(
      within(screen.getByRole("radiogroup", { name: "Label source" })).getByRole("radio", {
        name: "API"
      })
    );

    const combos = within(view.container).getAllByRole("combobox");
    await fireEvent.input(combos[0]!, { target: { value: "https://api.example.com/new" } });
    await fireEvent.input(combos[1]!, { target: { value: "group-b" } });

    expect(onPatch).toHaveBeenCalledWith({ sourceMode: "api" });
    expect(onPatch).toHaveBeenCalledWith({ apiEndpoint: "https://api.example.com/new" });
    expect(onPatch).toHaveBeenCalledWith({ updateGroup: "group-b" });
  });
});

