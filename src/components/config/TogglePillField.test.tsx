import { cleanup, fireEvent, render, screen, within } from "@solidjs/testing-library";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TogglePillField } from "./TogglePillField";

afterEach(() => {
  cleanup();
});

describe("TogglePillField", () => {
  it("renders label and reflects boolean selection", () => {
    render(() => (
      <TogglePillField
        label="Stacked"
        ariaLabel="Stacked mode"
        value={true}
        onChange={vi.fn()}
      />
    ));

    expect(screen.getByText("Stacked")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "On" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Off" })).toHaveAttribute("aria-checked", "false");
  });

  it("emits boolean values from on/off selections", async () => {
    const onChange = vi.fn();
    const view = render(() => (
      <TogglePillField
        label="Show grid"
        ariaLabel="Show grid toggle"
        value={false}
        onChange={onChange}
      />
    ));

    const scoped = within(view.container);
    await fireEvent.click(scoped.getByRole("radio", { name: "On" }));
    await fireEvent.click(scoped.getByRole("radio", { name: "Off" }));
    expect(onChange).toHaveBeenNthCalledWith(1, true);
    expect(onChange).toHaveBeenNthCalledWith(2, false);
  });
});

