import { APP_MODULE_IDS } from "../moduleRegistry";
import { APP_MODULE_CONTRACTS } from "../moduleContracts";
import { appHelpDoc } from "./appHelpDoc";
import type { HelpDocContributor, ModuleHelpDoc } from "./helpDocTypes";

const HELP_DOC_CONTRIBUTORS: HelpDocContributor[] = [
  { id: "application", docs: [appHelpDoc] },
  ...APP_MODULE_CONTRACTS.map((contract) => ({
    id: contract.id,
    docs: [...(contract.helpDocs ?? [])]
  }))
];

/**
 * Returns docs in app-level order so module docs appear consistently with navigation.
 */
export function getHelpDocs(): ModuleHelpDoc[] {
  const docs = HELP_DOC_CONTRIBUTORS.flatMap((contributor) => contributor.docs);
  const moduleRank = new Map(APP_MODULE_IDS.map((id, index) => [id, index]));
  return [...docs].sort((left, right) => {
    const leftRank = left.moduleId === "application" ? -1 : (moduleRank.get(left.moduleId) ?? 999);
    const rightRank = right.moduleId === "application" ? -1 : (moduleRank.get(right.moduleId) ?? 999);
    return leftRank - rightRank;
  });
}
