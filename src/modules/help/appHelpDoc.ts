import type { ModuleHelpDoc } from "./helpDocTypes";

export const appHelpDoc: ModuleHelpDoc = {
  moduleId: "application",
  title: "Application Overview",
  summary: "How to navigate the workspace and use shared application controls.",
  sections: [
    {
      id: "app-navigation",
      title: "Navigate Modules",
      bullets: [
        "Use the left rail to switch between top-level modules.",
        "Dashboards is the primary workspace where dashboard editing and runtime viewing happen.",
        "The Help module aggregates documentation from each module so guidance stays close to implementation."
      ]
    },
    {
      id: "app-topbar",
      title: "Topbar Controls",
      bullets: [
        "Use the time window menu to switch between relative and custom ranges.",
        "Use the user menu for account-level actions and user settings access.",
        "When available, module-specific actions appear in the center topbar region."
      ]
    }
  ]
};
