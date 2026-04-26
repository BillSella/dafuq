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

  it("returns denied copy for restricted modules", () => {
    expect(getModuleAccessDeniedMessage("settings")).toBe(
      "You do not currently have access to this module."
    );
  });
});
