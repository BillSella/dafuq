import { createEffect, onCleanup, type Accessor, type Setter } from "solid-js";
import { useDismissOnOutsideClick } from "../../hooks/useDismissOnOutsideClick";

type UseDashboardDismissalsOptions = {
  userMenuOpen: Accessor<boolean>;
  setUserMenuOpen: Setter<boolean>;
  userMenuRef: Accessor<HTMLDivElement | undefined>;
  userMenuButtonRef: Accessor<HTMLButtonElement | undefined>;
  timeWindowMenuOpen: Accessor<boolean>;
  setTimeWindowMenuOpen: Setter<boolean>;
  setTimeWindowMenuView: Setter<"list" | "custom">;
  timeWindowMenuRef: Accessor<HTMLDivElement | undefined>;
  timeWindowButtonRef: Accessor<HTMLButtonElement | undefined>;
  dashboardMenuOpen: Accessor<boolean>;
  setDashboardMenuOpen: Setter<boolean>;
  dashboardMenuRef: Accessor<HTMLDivElement | undefined>;
  dashboardMenuButtonRef: Accessor<HTMLButtonElement | undefined>;
  widgetMenuOpen: Accessor<boolean>;
  setWidgetMenuOpen: Setter<boolean>;
  widgetMenuRef: Accessor<HTMLDivElement | undefined>;
  widgetMenuButtonRef: Accessor<HTMLButtonElement | undefined>;
  visibilityMenuOpen: Accessor<boolean>;
  setVisibilityMenuOpen: Setter<boolean>;
  visibilityMenuRef: Accessor<HTMLDivElement | undefined>;
  visibilityMenuButtonRef: Accessor<HTMLButtonElement | undefined>;
  breakpointMenuOpen: Accessor<boolean>;
  setBreakpointMenuOpen: Setter<boolean>;
  breakpointMenuRef: Accessor<HTMLDivElement | undefined>;
  breakpointMenuButtonRef: Accessor<HTMLButtonElement | undefined>;
  rollbackMenuOpen: Accessor<boolean>;
  closeRollbackMenu: () => void;
  rollbackMenuRef: Accessor<HTMLDivElement | undefined>;
  rollbackButtonRef: Accessor<HTMLButtonElement | undefined>;
  dashboardSettingsOpen: Accessor<boolean>;
  setDashboardSettingsOpen: Setter<boolean>;
  dashboardSettingsPanelRef: Accessor<HTMLDivElement | undefined>;
  dashboardSettingsButtonRef: Accessor<HTMLButtonElement | undefined>;
  updateDashboardSettingsPlacement: () => void;
  activeDashboardName: Accessor<string>;
  setDashboardDeleteConfirmInput: Setter<string>;
};

/**
 * Centralizes outside-click and escape-key dismissal behavior for menus/overlays.
 */
export function useDashboardDismissals(options: UseDashboardDismissalsOptions) {
  useDismissOnOutsideClick({
    isOpen: options.userMenuOpen,
    containerRef: options.userMenuRef,
    triggerRef: options.userMenuButtonRef,
    onDismiss: () => options.setUserMenuOpen(false)
  });

  useDismissOnOutsideClick({
    isOpen: options.timeWindowMenuOpen,
    containerRef: options.timeWindowMenuRef,
    triggerRef: options.timeWindowButtonRef,
    onDismiss: () => {
      options.setTimeWindowMenuOpen(false);
      options.setTimeWindowMenuView("list");
    }
  });

  useDismissOnOutsideClick({
    isOpen: options.dashboardMenuOpen,
    containerRef: options.dashboardMenuRef,
    triggerRef: options.dashboardMenuButtonRef,
    onDismiss: () => options.setDashboardMenuOpen(false)
  });

  useDismissOnOutsideClick({
    isOpen: options.widgetMenuOpen,
    containerRef: options.widgetMenuRef,
    triggerRef: options.widgetMenuButtonRef,
    onDismiss: () => options.setWidgetMenuOpen(false)
  });

  useDismissOnOutsideClick({
    isOpen: options.visibilityMenuOpen,
    containerRef: options.visibilityMenuRef,
    triggerRef: options.visibilityMenuButtonRef,
    onDismiss: () => options.setVisibilityMenuOpen(false)
  });

  useDismissOnOutsideClick({
    isOpen: options.breakpointMenuOpen,
    containerRef: options.breakpointMenuRef,
    triggerRef: options.breakpointMenuButtonRef,
    onDismiss: () => options.setBreakpointMenuOpen(false)
  });

  useDismissOnOutsideClick({
    isOpen: options.rollbackMenuOpen,
    containerRef: options.rollbackMenuRef,
    triggerRef: options.rollbackButtonRef,
    onDismiss: options.closeRollbackMenu
  });

  createEffect(() => {
    if (!options.dashboardSettingsOpen()) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") options.setDashboardSettingsOpen(false);
    };
    const onPointerDownOutside = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (options.dashboardSettingsPanelRef()?.contains(target)) return;
      if (options.dashboardSettingsButtonRef()?.contains(target)) return;
      options.setDashboardSettingsOpen(false);
    };
    const onResizeOrScroll = () => options.updateDashboardSettingsPlacement();
    window.addEventListener("keydown", onEscape);
    window.addEventListener("pointerdown", onPointerDownOutside);
    window.addEventListener("resize", onResizeOrScroll);
    window.addEventListener("scroll", onResizeOrScroll, true);
    queueMicrotask(options.updateDashboardSettingsPlacement);
    onCleanup(() => {
      window.removeEventListener("keydown", onEscape);
      window.removeEventListener("pointerdown", onPointerDownOutside);
      window.removeEventListener("resize", onResizeOrScroll);
      window.removeEventListener("scroll", onResizeOrScroll, true);
    });
  });

  createEffect(() => {
    if (!options.dashboardSettingsOpen()) return;
    options.activeDashboardName();
    options.setDashboardDeleteConfirmInput("");
  });
}
