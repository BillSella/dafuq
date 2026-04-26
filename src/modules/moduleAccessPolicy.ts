import type { AppModuleId } from "./moduleTypes";

export type ModuleAccessContext = {
  isAuthenticated: boolean;
  /**
   * JWT scope/role claims placeholder for future policy expansion.
   */
  claims?: readonly string[];
};

/**
 * Central module access gate used by shell navigation and module hosts.
 * Keeps policy in one place so JWT claim checks can be introduced safely.
 */
export function hasModuleAccess(moduleId: AppModuleId, context: ModuleAccessContext): boolean {
  if (moduleId === "dashboards") return true;
  return context.isAuthenticated;
}

export function getModuleAccessDeniedMessage(moduleId: AppModuleId): string {
  if (moduleId === "dashboards") return "";
  return "You do not currently have access to this module.";
}
