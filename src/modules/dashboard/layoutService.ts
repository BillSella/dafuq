import { clamp } from "../../widgets/baseWidget";
import type { DashboardBreakpoint, WidgetPlacement } from "./dashboardStore";

/**
 * Breakpoint/grid projection helpers for responsive dashboard layouts.
 *
 * State modification contract:
 * - This module is pure and does not own mutable state.
 * - Callers provide viewport/placement inputs and receive derived layout outputs.
 * - Guard behavior: geometry outputs are clamped to valid target grid bounds.
 */

export const BREAKPOINT_OPTIONS: Array<{
  id: DashboardBreakpoint;
  label: string;
  minWidth: number;
}> = [
  { id: "uhd8k", label: "8K UHD", minWidth: 7680 },
  { id: "uhd4k", label: "4K UHD", minWidth: 3840 },
  { id: "qhd2k", label: "2K QHD", minWidth: 2560 },
  { id: "desktopFhd", label: "Desktop (FHD)", minWidth: 1920 },
  { id: "laptopWxga", label: "Laptop (WXGA)", minWidth: 1366 },
  { id: "tabletPortrait", label: "Tablet Portrait", minWidth: 768 },
  { id: "tabletLandscape", label: "Tablet Landscape", minWidth: 1024 },
  { id: "mobilePortrait", label: "Mobile Portrait", minWidth: 0 },
  { id: "mobileLandscape", label: "Mobile Landscape", minWidth: 800 }
];

export const BREAKPOINT_TARGET_GRID: Record<DashboardBreakpoint, { columns: number; rows: number }> = {
  uhd8k: { columns: 64, rows: 36 },
  uhd4k: { columns: 32, rows: 18 },
  qhd2k: { columns: 21, rows: 12 },
  desktopFhd: { columns: 16, rows: 9 },
  laptopWxga: { columns: 11, rows: 6 },
  tabletPortrait: { columns: 6, rows: 9 },
  tabletLandscape: { columns: 9, rows: 6 },
  mobilePortrait: { columns: 3, rows: 7 },
  mobileLandscape: { columns: 7, rows: 3 }
};

export const BREAKPOINT_IDS = BREAKPOINT_OPTIONS.map((option) => option.id);

/**
 * Resolves grid dimensions and cell step for a breakpoint and viewport.
 */
export function getGridSizeForBreakpoint(
  breakpoint: DashboardBreakpoint,
  viewportWidth: number,
  viewportHeight: number
): { columns: number; rows: number; step: number } {
  const target = BREAKPOINT_TARGET_GRID[breakpoint];
  const safeColumns = Math.max(1, target.columns);
  const safeRows = Math.max(1, target.rows);
  const step = Math.max(6, Math.floor(Math.min(viewportWidth / safeColumns, viewportHeight / safeRows)));
  return {
    columns: safeColumns,
    rows: safeRows,
    step
  };
}

/**
 * Detects the closest breakpoint id from current viewport size.
 */
export function detectBreakpointFromViewport(width: number, height: number): DashboardBreakpoint {
  if (width >= 7680) return "uhd8k";
  if (width >= 3840) return "uhd4k";
  if (width >= 2560) return "qhd2k";
  if (width >= 1920) return "desktopFhd";
  if (width >= 1366) return "laptopWxga";
  if (width >= 768) return width >= height ? "tabletLandscape" : "tabletPortrait";
  return width >= height ? "mobileLandscape" : "mobilePortrait";
}

/**
 * Projects a widget placement from the active breakpoint across all breakpoints.
 *
 * Preserves the active breakpoint placement exactly and scales/clamps others.
 */
export function projectPlacementAcrossBreakpoints(
  currentBreakpoint: DashboardBreakpoint,
  placement: Pick<WidgetPlacement, "colStart" | "rowStart" | "colSpan" | "rowSpan">,
  viewportWidth: number,
  viewportHeight: number
): WidgetPlacement[] {
  const sourceGrid = getGridSizeForBreakpoint(currentBreakpoint, viewportWidth, viewportHeight);
  return BREAKPOINT_IDS.map((breakpoint) => {
    if (breakpoint === currentBreakpoint) {
      return {
        breakpoint,
        colStart: placement.colStart,
        rowStart: placement.rowStart,
        colSpan: placement.colSpan,
        rowSpan: placement.rowSpan,
        visible: true
      };
    }

    const targetGrid = getGridSizeForBreakpoint(breakpoint, viewportWidth, viewportHeight);
    const minTargetSpan = Math.max(1, Math.ceil(16 / targetGrid.step));
    const targetColSpan = clamp(
      Math.round((placement.colSpan / Math.max(1, sourceGrid.columns)) * targetGrid.columns),
      minTargetSpan,
      targetGrid.columns
    );
    const targetRowSpan = clamp(
      Math.round((placement.rowSpan / Math.max(1, sourceGrid.rows)) * targetGrid.rows),
      minTargetSpan,
      targetGrid.rows
    );
    const maxTargetColStart = Math.max(1, targetGrid.columns - targetColSpan + 1);
    const maxTargetRowStart = Math.max(1, targetGrid.rows - targetRowSpan + 1);
    const targetColStart = clamp(
      Math.round(((placement.colStart - 1) / Math.max(1, sourceGrid.columns - 1)) * (maxTargetColStart - 1)) + 1,
      1,
      maxTargetColStart
    );
    const targetRowStart = clamp(
      Math.round(((placement.rowStart - 1) / Math.max(1, sourceGrid.rows - 1)) * (maxTargetRowStart - 1)) + 1,
      1,
      maxTargetRowStart
    );

    return {
      breakpoint,
      colStart: targetColStart,
      rowStart: targetRowStart,
      colSpan: targetColSpan,
      rowSpan: targetRowSpan,
      visible: true
    };
  });
}
