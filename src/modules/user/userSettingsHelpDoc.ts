import type { ModuleHelpDoc } from "../help/helpDocTypes";

export const userSettingsHelpDoc: ModuleHelpDoc = {
  moduleId: "userSettings",
  title: "User Settings Module",
  summary: "Manage user-specific preferences and profile behavior in the workspace.",
  sections: [
    {
      id: "user-settings-overview",
      title: "User Preference Scope",
      bullets: [
        "User Settings should store personal preferences, not shared team defaults.",
        "Typical settings include display preferences, notification defaults, and profile controls.",
        "Changes in this module should apply only to the signed-in user."
      ]
    },
    {
      id: "user-settings-documentation",
      title: "How to Extend Documentation",
      bullets: [
        "Add new preference instructions as a new section in this module-owned doc file.",
        "Reference labels used in the UI so help content maps directly to controls.",
        "Document side effects clearly, especially when a preference changes dashboard behavior."
      ]
    }
  ]
};
