import { cleanup, fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import { createSignal } from "solid-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDashboardRollback } from "./useDashboardRollback";

const mocks = vi.hoisted(() => ({
  fetchVersions: vi.fn(),
  rollbackToVersion: vi.fn()
}));

vi.mock("../modules/dashboard/dashboardServerSync", () => ({
  fetchDashboardVersionsFromServer: mocks.fetchVersions,
  rollbackDashboardToVersion: mocks.rollbackToVersion
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  mocks.fetchVersions.mockReset();
  mocks.rollbackToVersion.mockReset();
});

function Harness(props: { activeId: string }) {
  const [activeDashboardId] = createSignal(props.activeId);
  const [dashboards, setDashboards] = createSignal([
    { id: "d1", name: "One", widgets: [] },
    { id: "d2", name: "Two", widgets: [] }
  ] as any[]);
  const rollback = useDashboardRollback({
    activeDashboardId,
    setDashboards: setDashboards as any,
    breakpointIds: ["desktopFhd"] as any
  });

  return (
    <div>
      <div data-testid="menu-open">{String(rollback.rollbackMenuOpen())}</div>
      <div data-testid="busy">{String(rollback.rollbackBusy())}</div>
      <div data-testid="versions">{rollback.rollbackVersions().join(",")}</div>
      <div data-testid="dashboards">{dashboards().map((d) => d.name).join(",")}</div>
      <button type="button" onClick={() => void rollback.openRollbackMenu()}>
        open
      </button>
      <button type="button" onClick={() => rollback.closeRollbackMenu()}>
        close
      </button>
      <button type="button" onClick={() => void rollback.rollbackToVersion("t-1")}>
        rollback
      </button>
    </div>
  );
}

describe("useDashboardRollback", () => {
  it("opens menu and loads versions for active dashboard", async () => {
    mocks.fetchVersions.mockResolvedValue(["t1", "t2"]);
    render(() => <Harness activeId="d1" />);

    await fireEvent.click(screen.getByRole("button", { name: "open" }));
    await waitFor(() => {
      expect(screen.getByTestId("menu-open")).toHaveTextContent("true");
      expect(screen.getByTestId("versions")).toHaveTextContent("t1,t2");
      expect(screen.getByTestId("busy")).toHaveTextContent("false");
    });
  });

  it("opens menu with empty versions when no active dashboard", async () => {
    render(() => <Harness activeId="" />);

    await fireEvent.click(screen.getByRole("button", { name: "open" }));
    expect(screen.getByTestId("menu-open")).toHaveTextContent("true");
    expect(screen.getByTestId("versions")).toHaveTextContent("");
    expect(mocks.fetchVersions).not.toHaveBeenCalled();
  });

  it("rolls back active dashboard when confirmed", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    mocks.rollbackToVersion.mockResolvedValue({ id: "d1", name: "Rolled", widgets: [] });
    render(() => <Harness activeId="d1" />);

    await fireEvent.click(screen.getByRole("button", { name: "rollback" }));
    await waitFor(() => {
      expect(screen.getByTestId("dashboards")).toHaveTextContent("Rolled,Two");
      expect(screen.getByTestId("menu-open")).toHaveTextContent("false");
    });
  });

  it("alerts when rollback fails and preserves dashboards", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => undefined);
    mocks.rollbackToVersion.mockResolvedValue(null);
    render(() => <Harness activeId="d1" />);

    await fireEvent.click(screen.getByRole("button", { name: "rollback" }));
    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith("Rollback failed. Please try again.");
      expect(screen.getByTestId("dashboards")).toHaveTextContent("One,Two");
    });
  });
});

