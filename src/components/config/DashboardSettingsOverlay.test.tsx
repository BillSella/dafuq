import { cleanup, fireEvent, render, screen, within } from "@solidjs/testing-library";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DashboardSettingsOverlay } from "./DashboardSettingsOverlay";

afterEach(() => {
  cleanup();
});

function renderOverlay(overrides?: Partial<Parameters<typeof DashboardSettingsOverlay>[0]>) {
  const props = {
    panelRef: () => undefined,
    open: true,
    top: 40,
    left: 50,
    width: 480,
    height: 360,
    dashboardName: "Plant Ops",
    updateFrequencySeconds: 60,
    frequencyOptions: [1, 5, 15, 60, 180] as const,
    deleteConfirmInput: "",
    onRename: vi.fn(),
    onFrequencyIndexChange: vi.fn(),
    onDeleteConfirmInputChange: vi.fn(),
    onDelete: vi.fn(),
    ...overrides
  };
  const view = render(() => <DashboardSettingsOverlay {...props} />);
  return { view, props };
}

describe("DashboardSettingsOverlay", () => {
  it("renders selected frequency index and overlay shell styles", () => {
    const { view } = renderOverlay({ updateFrequencySeconds: 60 });
    const range = screen.getByRole("slider") as HTMLInputElement;
    expect(range.value).toBe("3");

    const panel = view.container.querySelector(".dashboard-settings-panel");
    expect(panel).toHaveClass("open");
    expect(panel).toHaveClass("slide-bottom");
    expect(panel).toHaveStyle({
      top: "40px",
      left: "50px",
      width: "480px",
      height: "360px"
    });
  });

  it("clamps unknown frequency values to index 0", () => {
    renderOverlay({ updateFrequencySeconds: 999 });
    expect((screen.getByRole("slider") as HTMLInputElement).value).toBe("0");
  });

  it("routes input and delete interactions through callbacks", async () => {
    const { view, props } = renderOverlay({ deleteConfirmInput: "Plant Ops" });
    const scoped = within(view.container);
    const nameInput = view.container.querySelector(
      "label.field input[type='text']"
    ) as HTMLInputElement | null;
    expect(nameInput).toBeInTheDocument();

    await fireEvent.input(nameInput!, { target: { value: "Plant Ops Updated" } });
    expect(props.onRename).toHaveBeenCalledWith("Plant Ops Updated");

    await fireEvent.input(scoped.getByRole("slider"), { target: { value: "3" } });
    expect(props.onFrequencyIndexChange).toHaveBeenCalledWith(3);

    await fireEvent.input(scoped.getByPlaceholderText("Enter Dashboard Name to Delete"), {
      currentTarget: { value: "Plant Ops" }
    });
    expect(props.onDeleteConfirmInputChange).toHaveBeenCalledWith("Plant Ops");

    const deleteButton = scoped.getByRole("button", { name: "Delete" });
    expect(deleteButton).toBeEnabled();
    await fireEvent.click(deleteButton);
    expect(props.onDelete).toHaveBeenCalledTimes(1);
  });

  it("disables delete button when confirmation does not match", () => {
    renderOverlay({ deleteConfirmInput: "Wrong Name" });
    expect(screen.getByRole("button", { name: "Delete" })).toBeDisabled();
  });
});

