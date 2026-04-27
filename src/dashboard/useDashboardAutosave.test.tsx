import { cleanup, fireEvent, render, screen } from "@solidjs/testing-library";
import { createSignal } from "solid-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDashboardAutosave } from "./useDashboardAutosave";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function Harness(props: {
  ready?: boolean;
  authed?: boolean;
  docs?: any[];
  persistToStorage: (docs: any[]) => void;
  saveToServer: (docs: any[]) => Promise<void> | void;
  delayMs?: number;
}) {
  const [dashboards, setDashboards] = createSignal(props.docs ?? [{ id: "d1" }]);
  const [serverSyncReady, setServerSyncReady] = createSignal(props.ready ?? true);
  const [isAuthenticated, setIsAuthenticated] = createSignal(props.authed ?? true);

  useDashboardAutosave({
    dashboards: dashboards as any,
    serverSyncReady,
    isAuthenticated,
    persistToStorage: props.persistToStorage as any,
    saveToServer: props.saveToServer as any,
    delayMs: props.delayMs
  });

  return (
    <div>
      <button type="button" onClick={() => setDashboards([{ id: "d2" }])}>
        change
      </button>
      <button type="button" onClick={() => setServerSyncReady(false)}>
        not-ready
      </button>
      <button type="button" onClick={() => setIsAuthenticated(false)}>
        unauth
      </button>
    </div>
  );
}

describe("useDashboardAutosave", () => {
  it("persists immediately and saves after debounce", async () => {
    vi.useFakeTimers();
    const persistToStorage = vi.fn();
    const saveToServer = vi.fn().mockResolvedValue(undefined);

    render(() => (
      <Harness persistToStorage={persistToStorage} saveToServer={saveToServer} delayMs={1200} />
    ));

    expect(persistToStorage).toHaveBeenCalledWith([{ id: "d1" }]);
    expect(saveToServer).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1199);
    expect(saveToServer).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(saveToServer).toHaveBeenCalledWith([{ id: "d1" }]);
  });

  it("skips server save when sync is not ready or user is unauthenticated", () => {
    vi.useFakeTimers();
    const persistToStorage = vi.fn();
    const saveToServer = vi.fn();

    render(() => (
      <Harness
        persistToStorage={persistToStorage}
        saveToServer={saveToServer}
        ready={false}
        authed={false}
      />
    ));

    vi.advanceTimersByTime(5000);
    expect(persistToStorage).toHaveBeenCalled();
    expect(saveToServer).not.toHaveBeenCalled();
  });

  it("cancels a pending save when auth becomes unavailable", async () => {
    vi.useFakeTimers();
    const persistToStorage = vi.fn();
    const saveToServer = vi.fn();

    render(() => (
      <Harness persistToStorage={persistToStorage} saveToServer={saveToServer} ready authed delayMs={1200} />
    ));

    await fireEvent.click(screen.getByRole("button", { name: "change" }));
    vi.advanceTimersByTime(600);
    await fireEvent.click(screen.getByRole("button", { name: "unauth" }));
    vi.advanceTimersByTime(2000);

    expect(saveToServer).not.toHaveBeenCalled();
  });

  it("clears pending timer on cleanup (unmount)", async () => {
    vi.useFakeTimers();
    const persistToStorage = vi.fn();
    const saveToServer = vi.fn();

    const view = render(() => (
      <Harness persistToStorage={persistToStorage} saveToServer={saveToServer} delayMs={1200} />
    ));

    await fireEvent.click(screen.getByRole("button", { name: "change" }));
    vi.advanceTimersByTime(600);
    view.unmount();
    vi.advanceTimersByTime(5000);

    expect(saveToServer).not.toHaveBeenCalledWith([{ id: "d2" }]);
  });
});

