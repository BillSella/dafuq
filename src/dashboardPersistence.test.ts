import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearPersistedDashboards,
  createDefaultDashboards,
  loadDashboardsFromStorage,
  persistDashboardsToStorage
} from "./dashboardPersistence";

vi.mock("./dashboardStore", () => ({
  DASHBOARD_INDEX_STORAGE_KEY: "dashboard:index",
  createDashboardDoc: vi.fn(),
  makeDashboardStorageKey: (id: string) => `dashboard:${id}.json`,
  normalizeDashboardDoc: (doc: unknown) => doc
}));

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("dashboardPersistence", () => {
  it("returns empty defaults", () => {
    expect(createDefaultDashboards(["desktopFhd"] as never)).toEqual([]);
  });

  it("loads default when no index exists", () => {
    const loaded = loadDashboardsFromStorage(["desktopFhd"] as never);
    expect(loaded).toEqual([]);
  });

  it("persists and reloads dashboards from localStorage", () => {
    const docs = [
      { id: "a", name: "A", widgets: [] },
      { id: "b", name: "B", widgets: [] }
    ] as never;

    persistDashboardsToStorage(docs);
    const index = localStorage.getItem("dashboard:index");
    expect(index).toBe(JSON.stringify(["a", "b"]));
    expect(localStorage.getItem("dashboard:a.json")).toContain("\"id\": \"a\"");

    const loaded = loadDashboardsFromStorage(["desktopFhd"] as never);
    expect(loaded).toHaveLength(2);
    expect((loaded[0] as { id: string }).id).toBe("a");
  });

  it("falls back to defaults when index is malformed", () => {
    localStorage.setItem("dashboard:index", "{bad");
    expect(loadDashboardsFromStorage(["desktopFhd"] as never)).toEqual([]);
  });

  it("clears persisted index and dashboard payloads", () => {
    localStorage.setItem("dashboard:index", JSON.stringify(["x", "y"]));
    localStorage.setItem("dashboard:x.json", JSON.stringify({ id: "x" }));
    localStorage.setItem("dashboard:y.json", JSON.stringify({ id: "y" }));

    clearPersistedDashboards();

    expect(localStorage.getItem("dashboard:index")).toBeNull();
    expect(localStorage.getItem("dashboard:x.json")).toBeNull();
    expect(localStorage.getItem("dashboard:y.json")).toBeNull();
  });
});

