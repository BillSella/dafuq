import type { ModuleHelpDoc } from "../help/helpDocTypes";

export const settingsHelpDoc: ModuleHelpDoc = {
  moduleId: "settings",
  title: "Application Settings Module",
  summary: "Configure environment-wide defaults and operational preferences.",
  sections: [
    {
      id: "settings-purpose",
      title: "What Belongs Here",
      bullets: [
        "Global app configuration that impacts multiple modules belongs in this module.",
        "Examples include API endpoints, shared defaults, and environment controls.",
        "This area should avoid module-specific settings that are owned by a single module."
      ]
    },
    {
      id: "settings-growth",
      title: "Documentation Growth Pattern",
      bullets: [
        "Add new settings guidance as sections in this file when features land.",
        "The Help module will automatically include these updates through the shared docs registry.",
        "Keep step-by-step instructions concise so users can apply config changes quickly."
      ]
    }
  ]
};
