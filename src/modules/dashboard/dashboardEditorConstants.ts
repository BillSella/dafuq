import type { WidgetType, WidgetStateByType } from "../../widgets/widgetRegistry";

export type SlideDirection = "left" | "right" | "top" | "bottom";

export type DashboardWidget = WidgetStateByType;

export const LIBRARY_WIDGET_KEY = "application/x-dashboard-widget";

export const DEBUG_WIDGET_EVENTS = true;

export const WIDGET_SETTINGS_LEFT_COLUMN_WIDTH = 450;
export const WIDGET_SETTINGS_RIGHT_COLUMN_WIDTH = 840;
export const WIDGET_SETTINGS_DIVIDER_WIDTH = 1;
export const WIDGET_SETTINGS_COLUMN_GAP = 12;
export const WIDGET_SETTINGS_PANEL_CHROME = 32;

export function widgetTypeIcon(type: WidgetType): string {
  switch (type) {
    case "numberGauge":
      return "◔";
    case "label":
      return "T";
    case "donutChart":
      return "◍";
    case "barChart":
      return "▤";
    case "sparklineChart":
      return "⤴";
    case "timeSeriesChart":
      return "⏱";
    case "mapNetwork":
      return "◎";
    default:
      return "•";
  }
}
