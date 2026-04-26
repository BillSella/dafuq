import type { ModuleHelpDoc } from "../help/helpDocTypes";

export const trafficHelpDoc: ModuleHelpDoc = {
  moduleId: "trafficAnalysis",
  title: "Traffic Analysis Module",
  summary: "Investigate traffic behavior, trends, and anomalies across monitored systems.",
  sections: [
    {
      id: "traffic-coming-soon",
      title: "Current Status",
      bullets: [
        "Traffic Analysis is scaffolded as a module and available in module navigation.",
        "The module contract is active, so new traffic documentation can be added without changing help rendering logic.",
        "Initial analytics views can be delivered incrementally behind this module boundary."
      ]
    },
    {
      id: "traffic-next",
      title: "Planned Usage",
      bullets: [
        "Use this module to inspect traffic volume and directional flow over time.",
        "Expect guided filters for service, route, and time range to narrow investigations.",
        "Future releases can add runbooks and alert triage tips as additional help sections."
      ]
    }
  ]
};
