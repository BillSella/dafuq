/**
 * Top-level application modules (nav rail + main host).
 * JWT / policy layers can filter this set later without changing call sites.
 */
export type AppModuleId =
  | "dashboards"
  | "trafficAnalysis"
  | "help"
  | "settings"
  | "userSettings";
