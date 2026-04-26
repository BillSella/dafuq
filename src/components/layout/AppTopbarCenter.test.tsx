import { cleanup, fireEvent, render, within } from "@solidjs/testing-library";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppTopbarCenter } from "./AppTopbarCenter";
import type { DashboardBreakpoint } from "../../modules/dashboard/dashboardStore";
import type { WidgetLibraryItem } from "../../widgets/widgetRegistry";

type CenterProps = Parameters<typeof AppTopbarCenter>[0];

afterEach(() => {
  cleanup();
});

const defaultWidgetLibrary: WidgetLibraryItem[] = [
  { id: "numberGauge", label: "Number Gauge", shortLabel: "Gauge", category: "Data" },
  { id: "donutChart", label: "Donut Chart", shortLabel: "Donut", category: "Data" }
];

const createProps = (overrides: Partial<CenterProps> = {}): CenterProps => ({
  activeNavTool: "dashboards",
  activeToolTitle: "Help",
  activeDashboardName: "Main Dashboard",
  dashboards: [
    {
      id: "dash-1",
      name: "Main Dashboard",
      updateFrequencySeconds: 60,
      enabledBreakpoints: {
        uhd8k: true,
        uhd4k: true,
        qhd2k: true,
        desktopFhd: true,
        laptopWxga: true,
        tabletPortrait: true,
        tabletLandscape: true,
        mobilePortrait: true,
        mobileLandscape: true
      },
      extraGridRows: {
        uhd8k: 0,
        uhd4k: 0,
        qhd2k: 0,
        desktopFhd: 0,
        laptopWxga: 0,
        tabletPortrait: 0,
        tabletLandscape: 0,
        mobilePortrait: 0,
        mobileLandscape: 0
      },
      widgets: []
    },
    {
      id: "dash-2",
      name: "Backup Dashboard",
      updateFrequencySeconds: 60,
      enabledBreakpoints: {
        uhd8k: true,
        uhd4k: true,
        qhd2k: true,
        desktopFhd: true,
        laptopWxga: true,
        tabletPortrait: true,
        tabletLandscape: true,
        mobilePortrait: true,
        mobileLandscape: true
      },
      extraGridRows: {
        uhd8k: 0,
        uhd4k: 0,
        qhd2k: 0,
        desktopFhd: 0,
        laptopWxga: 0,
        tabletPortrait: 0,
        tabletLandscape: 0,
        mobilePortrait: 0,
        mobileLandscape: 0
      },
      widgets: []
    }
  ],
  activeDashboardId: "dash-1",
  dashboardMenuOpen: true,
  dashboardLocked: true,
  dashboardSettingsOpen: false,
  widgetMenuOpen: true,
  breakpointMenuOpen: true,
  selectedBreakpoint: "desktopFhd",
  selectedBreakpointLabel: "Desktop (FHD)",
  enabledBreakpointOptions: [{ id: "desktopFhd", label: "Desktop (FHD)" }],
  widgetLibrary: defaultWidgetLibrary,
  isBreakpointEnabledForActiveDashboard: (breakpoint: DashboardBreakpoint) => breakpoint !== "uhd8k",
  onToggleDashboardMenu: vi.fn(),
  onCreateDashboard: vi.fn(),
  onSelectDashboard: vi.fn(),
  onToggleDashboardSettings: vi.fn(),
  rollbackMenuOpen: true,
  rollbackBusy: false,
  rollbackVersions: ["2026-04-25 16-08-08"],
  onToggleRollbackMenu: vi.fn(),
  onRollbackToVersion: vi.fn(),
  onToggleWidgetMenu: vi.fn(),
  onLibraryPointerDown: vi.fn(),
  onLibraryDragStart: vi.fn(),
  onLibraryDragEnd: vi.fn(),
  onAddWidgetFromMenu: vi.fn(),
  onAddGridPage: vi.fn(),
  onToggleDashboardLocked: vi.fn(),
  onToggleBreakpointMenu: vi.fn(),
  onSelectBreakpoint: vi.fn(),
  onSetDashboardBreakpointEnabled: vi.fn(),
  widgetTypeIcon: () => "•",
  ...overrides
});

describe("AppTopbarCenter", () => {
  it("renders non-dashboard title without dashboard controls", () => {
    const props = createProps({ activeNavTool: "help", activeToolTitle: "Help Center" });
    const view = render(() => <AppTopbarCenter {...props} />);
    const local = within(view.container);

    expect(local.getByText("Help Center")).toBeInTheDocument();
    expect(local.queryByRole("button", { name: "Unlock dashboard" })).not.toBeInTheDocument();
    expect(local.queryByRole("button", { name: "Breakpoints" })).not.toBeInTheDocument();
  });

  it("disables dashboard switch while unlocked and exposes edit callbacks", async () => {
    const props = createProps({ dashboardLocked: false });
    const view = render(() => <AppTopbarCenter {...props} />);
    const local = within(view.container);

    const dashboardSwitcher = local.getByRole("button", { name: "Dashboards: Main Dashboard" });
    expect(dashboardSwitcher).toBeDisabled();

    await fireEvent.click(local.getByRole("button", { name: "Dashboard settings" }));
    await fireEvent.click(local.getByRole("button", { name: "Lock dashboard" }));
    await fireEvent.click(local.getByRole("button", { name: "Add one page of grid rows" }));
    await fireEvent.click(local.getByRole("button", { name: "Add widget" }));

    expect(props.onToggleDashboardSettings).toHaveBeenCalledTimes(1);
    expect(props.onToggleDashboardLocked).toHaveBeenCalledTimes(1);
    expect(props.onAddGridPage).toHaveBeenCalledTimes(1);
    expect(props.onToggleWidgetMenu).toHaveBeenCalledTimes(1);

    await fireEvent.pointerDown(local.getByRole("menuitem", { name: "Number Gauge" }));
    await fireEvent.click(local.getByRole("menuitem", { name: "Number Gauge" }));
    expect(props.onLibraryPointerDown).toHaveBeenCalledWith("numberGauge");
    expect(props.onAddWidgetFromMenu).toHaveBeenCalledWith("numberGauge");
  });

  it("routes dashboard selection and locked breakpoint actions through callbacks", async () => {
    const props = createProps({ dashboardLocked: true });
    const view = render(() => <AppTopbarCenter {...props} />);
    const local = within(view.container);

    await fireEvent.click(local.getByRole("button", { name: "Dashboards: Main Dashboard" }));
    expect(props.onToggleDashboardMenu).toHaveBeenCalledTimes(1);

    await fireEvent.click(local.getByRole("menuitem", { name: "+ New Dashboard" }));
    await fireEvent.click(local.getByRole("menuitem", { name: "Backup Dashboard" }));
    expect(props.onCreateDashboard).toHaveBeenCalledTimes(1);
    expect(props.onSelectDashboard).toHaveBeenCalledWith("dash-2");

    await fireEvent.click(local.getByRole("button", { name: "Breakpoints" }));
    expect(props.onToggleBreakpointMenu).toHaveBeenCalledTimes(1);

    await fireEvent.click(local.getByRole("menuitem", { name: "Desktop (FHD)" }));
    expect(props.onSelectBreakpoint).toHaveBeenCalledWith("desktopFhd");
    expect(props.onSelectBreakpoint).toHaveBeenCalledTimes(1);
  });

  it("routes unlocked rollback and breakpoint-toggle checkbox callbacks", async () => {
    const props = createProps({
      dashboardLocked: false,
      rollbackMenuOpen: true,
      breakpointMenuOpen: true
    });
    const view = render(() => <AppTopbarCenter {...props} />);
    const local = within(view.container);

    await fireEvent.click(local.getByRole("button", { name: "Rollback dashboard" }));
    await fireEvent.click(local.getByRole("menuitem", { name: "2026-04-25 16-08-08" }));
    expect(props.onToggleRollbackMenu).toHaveBeenCalledTimes(1);
    expect(props.onRollbackToVersion).toHaveBeenCalledWith("2026-04-25 16-08-08");

    await fireEvent.click(local.getByRole("menuitem", { name: "8K UHD" }));
    expect(props.onSelectBreakpoint).not.toHaveBeenCalled();

    const firstCheckbox = local.getAllByRole("checkbox")[0];
    await fireEvent.click(firstCheckbox);
    expect(props.onSetDashboardBreakpointEnabled).toHaveBeenCalledTimes(1);
  });
});

