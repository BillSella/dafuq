import type { ModuleHelpDoc } from "./helpDocTypes";

export const helpModuleHelpDoc: ModuleHelpDoc = {
  moduleId: "help",
  title: "Help Module",
  summary: "Discover guidance contributed by each module through a shared documentation contract.",
  sections: [
    {
      id: "help-usage",
      title: "How to Use Help",
      bullets: [
        "Open Help from the left navigation rail to view application and module guides.",
        "Docs are grouped by module so users can find instructions close to each feature area.",
        "Use section headings to scan quickly for setup, workflows, and troubleshooting notes."
      ]
    },
    {
      id: "help-extension",
      title: "How Modules Contribute Docs",
      bullets: [
        "Each module can ship its own documentation file under its module directory.",
        "Module contracts define docs and access requirements in one place.",
        "The Help page aggregates contract contributions automatically, without UI rewiring."
      ]
    }
  ]
};
