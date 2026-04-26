import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchDashboardVersionsFromServer,
  fetchDashboardsFromServer,
  rollbackDashboardToVersion,
  saveDashboardsToServer
} from "./dashboardServerSync";

const mockFns = vi.hoisted(() => ({
  getAccessToken: vi.fn(),
  normalizeDashboardDoc: vi.fn()
}));

vi.mock("../../authToken", () => ({
  getAccessToken: mockFns.getAccessToken
}));

vi.mock("./dashboardStore", () => ({
  normalizeDashboardDoc: mockFns.normalizeDashboardDoc
}));

afterEach(() => {
  vi.restoreAllMocks();
  mockFns.getAccessToken.mockReset();
  mockFns.normalizeDashboardDoc.mockReset();
});

describe("dashboardServerSync", () => {
  it("returns null for fetch when unauthenticated", async () => {
    mockFns.getAccessToken.mockReturnValue(null);
    const result = await fetchDashboardsFromServer(["desktopFhd"] as never);
    expect(result).toBeNull();
  });

  it("normalizes and filters fetched dashboards", async () => {
    mockFns.getAccessToken.mockReturnValue("token");
    mockFns.normalizeDashboardDoc
      .mockReturnValueOnce({ id: "d1", name: "One", widgets: [] })
      .mockReturnValueOnce({ id: "", name: "", widgets: [] });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          version: 1,
          dashboards: [{ id: "raw-1" }, { id: "raw-2" }]
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const result = await fetchDashboardsFromServer(["desktopFhd"] as never);
    expect(result).toEqual([{ id: "d1", name: "One", widgets: [] }]);
  });

  it("returns false from save when unauthenticated and true on 2xx", async () => {
    mockFns.getAccessToken.mockReturnValue(null);
    expect(await saveDashboardsToServer([] as never)).toBe(false);

    mockFns.getAccessToken.mockReturnValue("token");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 200 })
    );
    const docs = [{ id: "d1", name: "Dash", widgets: [] }] as never;
    expect(await saveDashboardsToServer(docs)).toBe(true);
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/v1/dashboards",
      expect.objectContaining({ method: "PUT" })
    );
  });

  it("handles versions endpoint response shaping", async () => {
    mockFns.getAccessToken.mockReturnValue("token");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          versions: [{ timestamp: "t1" }, { timestamp: "t2" }, { no: "timestamp" }]
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const versions = await fetchDashboardVersionsFromServer("dash-1");
    expect(versions).toEqual(["t1", "t2"]);
  });

  it("rolls back dashboard and validates normalized document", async () => {
    mockFns.getAccessToken.mockReturnValue("token");
    mockFns.normalizeDashboardDoc.mockReturnValue({
      id: "dash-1",
      name: "Dashboard",
      widgets: []
    });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ dashboard: { id: "raw" } }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const rolledBack = await rollbackDashboardToVersion(
      "dash-1",
      "2026-04-25 16-08-08",
      ["desktopFhd"] as never
    );
    expect(rolledBack).toEqual({ id: "dash-1", name: "Dashboard", widgets: [] });
  });
});
