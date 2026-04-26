import type { AppModuleId } from "./moduleTypes";

export type AppModuleDefinition = {
  id: AppModuleId;
  topbarTitle: string;
  /** Main-region copy when this module is not the dashboards workspace */
  placeholderMessage?: string;
};

const APP_MODULE_BY_ID: Record<AppModuleId, AppModuleDefinition> = {
  dashboards: { id: "dashboards", topbarTitle: "Dashboards" },
  trafficAnalysis: {
    id: "trafficAnalysis",
    topbarTitle: "Traffic Analysis",
    placeholderMessage: "Traffic Analysis view placeholder."
  },
  help: {
    id: "help",
    topbarTitle: "Help",
    placeholderMessage: "Help documentation module."
  },
  userSettings: {
    id: "userSettings",
    topbarTitle: "User Settings",
    placeholderMessage: "User Settings view placeholder."
  },
  settings: {
    id: "settings",
    topbarTitle: "Settings",
    placeholderMessage: "Settings view placeholder."
  }
};

/** Stable iteration order for future policy-driven nav / module loading */
export const APP_MODULE_IDS: AppModuleId[] = [
  "dashboards",
  "trafficAnalysis",
  "help",
  "settings",
  "userSettings"
];

export function getAppModule(id: AppModuleId): AppModuleDefinition {
  return APP_MODULE_BY_ID[id];
}

export function getModulePlaceholderMessage(id: AppModuleId): string {
  return getAppModule(id).placeholderMessage ?? "";
}
