import { APP_MODULE_IDS } from "../moduleRegistry";
import { dashboardHelpDoc } from "../dashboard/dashboardHelpDoc";
import { appHelpDoc } from "./appHelpDoc";
import type { ModuleHelpDoc } from "./helpDocTypes";

const HELP_DOCS: ModuleHelpDoc[] = [appHelpDoc, dashboardHelpDoc];

/**
 * Returns docs in app-level order so module docs appear consistently with navigation.
 */
export function getHelpDocs(): ModuleHelpDoc[] {
  const moduleRank = new Map(APP_MODULE_IDS.map((id, index) => [id, index]));
  return [...HELP_DOCS].sort((left, right) => {
    const leftRank = left.moduleId === "application" ? -1 : (moduleRank.get(left.moduleId) ?? 999);
    const rightRank = right.moduleId === "application" ? -1 : (moduleRank.get(right.moduleId) ?? 999);
    return leftRank - rightRank;
  });
}
