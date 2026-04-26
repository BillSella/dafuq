import { describe, expect, it } from "vitest";
import { APP_MODULE_IDS } from "./moduleRegistry";
import { APP_MODULE_CONTRACTS, getModuleContract } from "./moduleContracts";

describe("moduleContracts", () => {
  it("defines exactly one contract per app module", () => {
    const contractIds = APP_MODULE_CONTRACTS.map((contract) => contract.id);
    expect(new Set(contractIds)).toEqual(new Set(APP_MODULE_IDS));
    expect(contractIds).toHaveLength(APP_MODULE_IDS.length);
  });

  it("provides module-owned help docs for every module", () => {
    for (const moduleId of APP_MODULE_IDS) {
      const contract = getModuleContract(moduleId);
      expect(contract.helpDocs?.length ?? 0).toBeGreaterThan(0);
    }
  });

  it("keeps required claims aligned with current authorization intent", () => {
    expect(getModuleContract("dashboards").requiredClaims).toBeUndefined();
    expect(getModuleContract("help").requiredClaims).toBeUndefined();
    expect(getModuleContract("trafficAnalysis").requiredClaims).toEqual([
      "module:trafficAnalysis:read"
    ]);
    expect(getModuleContract("settings").requiredClaims).toEqual(["module:settings:read"]);
    expect(getModuleContract("userSettings").requiredClaims).toEqual(["module:userSettings:read"]);
  });
});
