import type { AppModuleId } from "./moduleTypes";
import { getModuleContract } from "./moduleContracts";

export type ModuleAccessContext = {
  isAuthenticated: boolean;
  /**
   * JWT scope/role claims placeholder for future policy expansion.
   */
  claims?: readonly string[];
};

function hasAnyRequiredClaim(moduleId: AppModuleId, claims: readonly string[]): boolean {
  const requiredClaims = getModuleContract(moduleId).requiredClaims;
  if (!requiredClaims || requiredClaims.length === 0) return true;
  const claimSet = new Set(claims);
  return requiredClaims.some((claim) => claimSet.has(claim));
}

/**
 * Central module access gate used by shell navigation and module hosts.
 * Keeps policy in one place so JWT claim checks can be introduced safely.
 */
export function hasModuleAccess(moduleId: AppModuleId, context: ModuleAccessContext): boolean {
  if (moduleId === "dashboards") return true;
  if (!context.isAuthenticated) return false;
  if (!context.claims || context.claims.length === 0) return true;
  return hasAnyRequiredClaim(moduleId, context.claims);
}

export function getModuleAccessDeniedMessage(moduleId: AppModuleId): string {
  if (moduleId === "dashboards") return "";
  const requiredClaims = getModuleContract(moduleId).requiredClaims;
  if (requiredClaims?.length) {
    return `You do not currently have access to this module. Required claim: ${requiredClaims[0]}.`;
  }
  return "You do not currently have access to this module.";
}
