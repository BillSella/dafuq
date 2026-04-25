import { cleanup, fireEvent, render, screen } from "@solidjs/testing-library";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppTopbarTools } from "./AppTopbarTools";
import type { RelativePresetId, TimeWindowState } from "../../timeWindow";

const logOutSpy = vi.fn();

vi.mock("../../session/SessionContext", () => ({
  useSession: () => ({
    isAuthenticated: () => true,
    syncFromStorage: vi.fn(),
    logIn: vi.fn(),
    logOut: logOutSpy
  })
}));

type ToolProps = Parameters<typeof AppTopbarTools>[0];

afterEach(() => {
  cleanup();
});

const createProps = (overrides: Partial<ToolProps> = {}): ToolProps => {
  const relativePresets: ReadonlyArray<{ id: RelativePresetId; label: string }> = [
    { id: "last1h", label: "Last 1 Hour" },
    { id: "last4h", label: "Last 4 Hours" }
  ];
  const defaultTimeWindow: TimeWindowState = { kind: "relative", preset: "last1h" };

  return {
    currentClock: "4:00:00 PM",
    currentClockIso: "2026-04-25T20:00:00.000Z",
    topbarCustomTimeSpan: "4/25/2026, 3:00 PM - 4/25/2026, 4:00 PM",
    timeWindow: defaultTimeWindow,
    timeWindowMenuOpen: true,
    timeWindowMenuView: "list",
    customRangeFrom: "",
    customRangeTo: "",
    relativePresets,
    activeNavTool: "dashboards",
    userMenuOpen: true,
    timeWindowSummaryLabel: (timeWindow) => (timeWindow.kind === "relative" ? "Relative Window" : "Custom Window"),
    timeWindowButtonLabel: (timeWindow) => (timeWindow.kind === "relative" ? "1 Hour" : "Custom"),
    onToggleTimeWindowMenu: vi.fn(),
    onSetTimeWindowListView: vi.fn(),
    onSetTimeWindowCustomView: vi.fn(),
    onUpdateCustomRangeFrom: vi.fn(),
    onUpdateCustomRangeTo: vi.fn(),
    onApplyCustomTimeWindow: vi.fn(),
    onApplyRelativePreset: vi.fn(),
    onToggleUserMenu: vi.fn(),
    onOpenUserSettings: vi.fn(),
    onCloseUserMenu: vi.fn(),
    ...overrides
  };
};

describe("AppTopbarTools", () => {
  it("renders relative-time controls and dispatches menu callbacks", async () => {
    const props = createProps();
    render(() => <AppTopbarTools {...props} />);

    expect(screen.getByLabelText("Current time 4:00:00 PM")).toBeInTheDocument();

    await fireEvent.click(screen.getByRole("button", { name: "Time range for dashboard data" }));
    expect(props.onToggleTimeWindowMenu).toHaveBeenCalledTimes(1);

    await fireEvent.click(screen.getByRole("menuitem", { name: "Last 4 Hours" }));
    expect(props.onApplyRelativePreset).toHaveBeenCalledTimes(1);
    expect(props.onApplyRelativePreset).toHaveBeenLastCalledWith("last4h");

    await fireEvent.click(screen.getByRole("menuitem", { name: "Custom range..." }));
    expect(props.onSetTimeWindowCustomView).toHaveBeenCalledTimes(1);
  });

  it("renders custom-range editor and dispatches range callbacks", async () => {
    const props = createProps({
      timeWindow: { kind: "absolute", fromMs: 100, toMs: 200 },
      timeWindowMenuView: "custom",
      customRangeFrom: "2026-04-25T15:00",
      customRangeTo: "2026-04-25T16:00"
    });
    render(() => <AppTopbarTools {...props} />);

    expect(screen.getByLabelText(props.topbarCustomTimeSpan)).toBeInTheDocument();

    await fireEvent.click(screen.getByRole("button", { name: "← Back" }));
    expect(props.onSetTimeWindowListView).toHaveBeenCalledTimes(1);

    const fromInput = screen.getByDisplayValue("2026-04-25T15:00");
    const toInput = screen.getByDisplayValue("2026-04-25T16:00");
    await fireEvent.input(fromInput, { target: { value: "2026-04-25T14:30" } });
    await fireEvent.input(toInput, { target: { value: "2026-04-25T17:15" } });
    expect(props.onUpdateCustomRangeFrom).toHaveBeenCalledWith("2026-04-25T14:30");
    expect(props.onUpdateCustomRangeTo).toHaveBeenCalledWith("2026-04-25T17:15");

    await fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(props.onApplyCustomTimeWindow).toHaveBeenCalledTimes(1);
  });

  it("dispatches user menu callbacks and performs logout", async () => {
    logOutSpy.mockClear();
    const props = createProps();
    render(() => <AppTopbarTools {...props} />);

    await fireEvent.click(screen.getByRole("button", { name: "User menu" }));
    expect(props.onToggleUserMenu).toHaveBeenCalledTimes(1);

    await fireEvent.click(screen.getByRole("menuitem", { name: "User Settings" }));
    expect(props.onOpenUserSettings).toHaveBeenCalledTimes(1);

    await fireEvent.click(screen.getByRole("menuitem", { name: "Log Out" }));
    expect(logOutSpy).toHaveBeenCalledTimes(1);
    expect(props.onCloseUserMenu).toHaveBeenCalledTimes(1);
  });
});

