import { describe, expect, it } from "vitest";
import { APP_MODULE_IDS, getAppModule, getModulePlaceholderMessage } from "./moduleRegistry";

describe("moduleRegistry", () => {
  it("keeps module ids in stable nav order", () => {
    expect(APP_MODULE_IDS).toEqual([
      "dashboards",
      "trafficAnalysis",
      "help",
      "settings",
      "userSettings"
    ]);
  });

  it("returns module definitions by id", () => {
    expect(getAppModule("dashboards").topbarTitle).toBe("Dashboards");
    expect(getAppModule("help").topbarTitle).toBe("Help");
  });

  it("returns empty placeholder copy when a module does not define one", () => {
    expect(getModulePlaceholderMessage("dashboards")).toBe("");
  });

  it("returns placeholder copy for scaffolded modules", () => {
    expect(getModulePlaceholderMessage("trafficAnalysis")).toBe("Traffic Analysis view placeholder.");
    expect(getModulePlaceholderMessage("help")).toBe("Help documentation module.");
  });
});
