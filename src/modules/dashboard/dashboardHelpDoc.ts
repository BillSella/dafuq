import type { ModuleHelpDoc } from "../help/helpDocTypes";

export const dashboardHelpDoc: ModuleHelpDoc = {
  moduleId: "dashboards",
  title: "Dashboard Module",
  summary: "Build, configure, and monitor dashboards with responsive widget layouts.",
  sections: [
    {
      id: "dashboard-create",
      title: "Create and Manage Dashboards",
      bullets: [
        "Open the dashboard switcher in the topbar to create, rename, and select dashboards.",
        "Use dashboard settings to adjust update frequency and manage dashboard lifecycle actions.",
        "Use rollback when editing to restore a historical dashboard snapshot."
      ]
    },
    {
      id: "dashboard-edit",
      title: "Edit Dashboard Content",
      bullets: [
        "Unlock the dashboard to enable edit mode.",
        "Add widgets from the widget menu, then drag and resize them directly on the canvas.",
        "Use each widget's config panel to update data source, visual options, and breakpoint visibility."
      ]
    },
    {
      id: "dashboard-breakpoints",
      title: "Work Across Breakpoints",
      bullets: [
        "Choose breakpoints from the breakpoint selector to preview responsive layouts.",
        "Enable or disable breakpoints while editing to control where a dashboard is available.",
        "Widget placement and visibility are tracked per breakpoint to support tailored layouts."
      ]
    }
  ]
};
