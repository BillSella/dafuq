import { describe, expect, it } from "vitest";
import { getModuleAccessDeniedMessage, hasModuleAccess } from "./moduleAccessPolicy";

describe("moduleAccessPolicy", () => {
  it("always allows dashboards", () => {
    expect(hasModuleAccess("dashboards", { isAuthenticated: false })).toBe(true);
  });

  it("requires authentication for non-dashboard modules", () => {
    expect(hasModuleAccess("help", { isAuthenticated: false })).toBe(false);
    expect(hasModuleAccess("help", { isAuthenticated: true })).toBe(true);
  });

  it("keeps non-claim sessions compatible while JWT scopes are not present", () => {
    expect(hasModuleAccess("settings", { isAuthenticated: true, claims: [] })).toBe(true);
    expect(hasModuleAccess("trafficAnalysis", { isAuthenticated: true })).toBe(true);
  });

  it("enforces required claims when claims are present", () => {
    expect(hasModuleAccess("settings", { isAuthenticated: true, claims: ["module:settings:read"] })).toBe(
      true
    );
    expect(
      hasModuleAccess("settings", { isAuthenticated: true, claims: ["module:userSettings:read"] })
    ).toBe(false);
  });

  it("returns denied copy for restricted modules", () => {
    expect(getModuleAccessDeniedMessage("settings")).toContain("Required claim: module:settings:read");
  });
});
