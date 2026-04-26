import { dashboardHelpDoc } from "./dashboard/dashboardHelpDoc";
import { helpModuleHelpDoc } from "./help/helpModuleHelpDoc";
import type { ModuleHelpDoc } from "./help/helpDocTypes";
import type { AppModuleId } from "./moduleTypes";
import { settingsHelpDoc } from "./settings/settingsHelpDoc";
import { trafficHelpDoc } from "./traffic/trafficHelpDoc";
import { userSettingsHelpDoc } from "./user/userSettingsHelpDoc";

export type AppModuleContract = {
  id: AppModuleId;
  requiredClaims?: readonly string[];
  helpDocs?: readonly ModuleHelpDoc[];
};

/**
 * Shared module contract surface consumed by policy and help aggregation.
 */
export const APP_MODULE_CONTRACTS: readonly AppModuleContract[] = [
  { id: "dashboards", helpDocs: [dashboardHelpDoc] },
  { id: "trafficAnalysis", requiredClaims: ["module:trafficAnalysis:read"], helpDocs: [trafficHelpDoc] },
  { id: "help", helpDocs: [helpModuleHelpDoc] },
  { id: "settings", requiredClaims: ["module:settings:read"], helpDocs: [settingsHelpDoc] },
  { id: "userSettings", requiredClaims: ["module:userSettings:read"], helpDocs: [userSettingsHelpDoc] }
];

const MODULE_CONTRACT_BY_ID: Record<AppModuleId, AppModuleContract> = APP_MODULE_CONTRACTS.reduce(
  (acc, contract) => {
    acc[contract.id] = contract;
    return acc;
  },
  {} as Record<AppModuleId, AppModuleContract>
);

export function getModuleContract(moduleId: AppModuleId): AppModuleContract {
  return MODULE_CONTRACT_BY_ID[moduleId];
}
