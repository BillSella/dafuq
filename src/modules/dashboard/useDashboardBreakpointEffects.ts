import { createEffect, type Accessor, type Setter } from "solid-js";
import type { DashboardBreakpoint } from "../../dashboardStore";
import { detectBreakpointFromViewport } from "../../layoutService";

type UseDashboardBreakpointEffectsOptions = {
  hasManualBreakpointSelection: Accessor<boolean>;
  gridViewportWidth: Accessor<number>;
  gridViewportHeight: Accessor<number>;
  isBreakpointEnabledForActiveDashboard: (breakpoint: DashboardBreakpoint) => boolean;
  preferredEnabledBreakpoint: Accessor<DashboardBreakpoint | null>;
  selectedBreakpoint: Accessor<DashboardBreakpoint>;
  setSelectedBreakpoint: Setter<DashboardBreakpoint>;
  selectedGridStep: Accessor<number>;
  setGridUnitSize: Setter<number>;
};

/**
 * Keeps selected breakpoint and grid step synced with viewport + enablement policy.
 */
export function useDashboardBreakpointEffects(options: UseDashboardBreakpointEffectsOptions) {
  createEffect(() => {
    options.setGridUnitSize(options.selectedGridStep());
  });

  createEffect(() => {
    if (options.hasManualBreakpointSelection()) return;
    const width = options.gridViewportWidth();
    const height = options.gridViewportHeight();
    const detected = detectBreakpointFromViewport(width, height);
    const next = options.isBreakpointEnabledForActiveDashboard(detected)
      ? detected
      : options.preferredEnabledBreakpoint() ?? detected;
    if (options.selectedBreakpoint() !== next) {
      options.setSelectedBreakpoint(next);
    }
  });

  createEffect(() => {
    const current = options.selectedBreakpoint();
    if (options.isBreakpointEnabledForActiveDashboard(current)) return;
    const fallback = options.preferredEnabledBreakpoint();
    if (fallback) {
      options.setSelectedBreakpoint(fallback);
    }
  });
}
