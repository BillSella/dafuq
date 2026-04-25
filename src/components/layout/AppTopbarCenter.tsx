import { For, Show, type JSX } from "solid-js";
import type { DashboardBreakpoint, DashboardDoc } from "../../dashboardStore";
import { BREAKPOINT_OPTIONS } from "../../layoutService";
import type { WidgetLibraryItem, WidgetType } from "../../widgets/widgetRegistry";
import type { AppModuleId } from "../../modules/moduleTypes";
import { MenuDropdown } from "../ui/MenuDropdown";
import { ToolButton } from "../ui/ToolButton";

type AppTopbarCenterProps = {
  activeNavTool: AppModuleId;
  activeToolTitle: string;
  activeDashboardName: string;
  dashboards: DashboardDoc[];
  activeDashboardId: string;
  dashboardMenuOpen: boolean;
  dashboardLocked: boolean;
  dashboardSettingsOpen: boolean;
  widgetMenuOpen: boolean;
  breakpointMenuOpen: boolean;
  selectedBreakpoint: DashboardBreakpoint;
  selectedBreakpointLabel: string;
  enabledBreakpointOptions: { id: DashboardBreakpoint; label: string }[];
  widgetLibrary: WidgetLibraryItem[];
  dashboardMenuRef?: JSX.HTMLAttributes<HTMLDivElement>["ref"];
  dashboardMenuButtonRef?: JSX.HTMLAttributes<HTMLButtonElement>["ref"];
  dashboardSettingsButtonRef?: JSX.HTMLAttributes<HTMLButtonElement>["ref"];
  widgetMenuRef?: JSX.HTMLAttributes<HTMLDivElement>["ref"];
  widgetMenuButtonRef?: JSX.HTMLAttributes<HTMLButtonElement>["ref"];
  breakpointMenuRef?: JSX.HTMLAttributes<HTMLDivElement>["ref"];
  breakpointMenuButtonRef?: JSX.HTMLAttributes<HTMLButtonElement>["ref"];
  isBreakpointEnabledForActiveDashboard: (breakpoint: DashboardBreakpoint) => boolean;
  onToggleDashboardMenu: () => void;
  onCreateDashboard: () => void;
  onSelectDashboard: (dashboardId: string) => void;
  onToggleDashboardSettings: () => void;
  rollbackMenuOpen: boolean;
  rollbackBusy: boolean;
  rollbackVersions: string[];
  rollbackMenuRef?: JSX.HTMLAttributes<HTMLDivElement>["ref"];
  rollbackButtonRef?: JSX.HTMLAttributes<HTMLButtonElement>["ref"];
  onToggleRollbackMenu: () => void;
  onRollbackToVersion: (timestamp: string) => void;
  onToggleWidgetMenu: () => void;
  onLibraryPointerDown: (type: WidgetType) => void;
  onLibraryDragStart: (event: DragEvent, type: WidgetType) => void;
  onLibraryDragEnd: () => void;
  onAddWidgetFromMenu: (type: WidgetType) => void;
  onAddGridPage: () => void;
  onToggleDashboardLocked: () => void;
  onToggleBreakpointMenu: () => void;
  onSelectBreakpoint: (breakpoint: DashboardBreakpoint) => void;
  onSetDashboardBreakpointEnabled: (breakpoint: DashboardBreakpoint, enabled: boolean) => void;
  widgetTypeIcon: (type: WidgetType) => string;
};

/**
 * Center section of the top bar for dashboard context and editing controls.
 *
 * State modification contract:
 * - Source of truth: parent orchestration layer provides all state via props.
 * - Allowed mutation paths: `onToggle*`, `onSelect*`, `onAdd*`, and rollback callbacks.
 * - Guard rules: lock state gates editing actions, breakpoint editing controls,
 *   and dashboard-switch affordances.
 *
 * Significant decisions:
 * - When unlocked (editing), dashboard menus expose edit operations.
 * - Lock state is treated as a policy gate, not local component state.
 */
export function AppTopbarCenter(props: AppTopbarCenterProps) {
  return (
    <div class="app-topbar-center">
      {props.activeNavTool === "dashboards" ? (
        <div class="tool-switcher-shell">
          <ToolButton
            ref={props.dashboardMenuButtonRef}
            class="app-topbar-title tool-switcher-button"
            classList={{ open: props.dashboardMenuOpen }}
            type="button"
            disabled={!props.dashboardLocked}
            aria-expanded={props.dashboardMenuOpen}
            onClick={props.onToggleDashboardMenu}
          >
            <span class="tool-switcher-icon" aria-hidden="true">
              <svg viewBox="0 0 16 16">
                <path d="M4 5.25L8 9l4-3.75" />
                <path d="M4 8.25L8 12l4-3.75" />
              </svg>
            </span>
            {`Dashboards: ${props.activeDashboardName}`}
          </ToolButton>
          <MenuDropdown
            ref={props.dashboardMenuRef}
            class="tool-switcher-dropdown"
            open={props.dashboardMenuOpen}
            role="menu"
            aria-label="Choose dashboard"
          >
            <button
              class="tool-switcher-item tool-switcher-create"
              type="button"
              role="menuitem"
              onClick={props.onCreateDashboard}
            >
              + New Dashboard
            </button>
            <For each={props.dashboards}>
              {(dashboard) => (
                <button
                  class="tool-switcher-item"
                  classList={{ active: props.activeDashboardId === dashboard.id }}
                  type="button"
                  role="menuitem"
                  onClick={() => props.onSelectDashboard(dashboard.id)}
                >
                  {dashboard.name}
                </button>
              )}
            </For>
          </MenuDropdown>
        </div>
      ) : (
        <div class="app-topbar-title">{props.activeToolTitle}</div>
      )}

      {props.activeNavTool === "dashboards" ? (
        <div class="dashboard-center-controls">
          <div class="dashboard-edit-tools" classList={{ open: !props.dashboardLocked }}>
            <ToolButton
              ref={props.dashboardSettingsButtonRef}
              class="dashboard-settings-toggle"
              classList={{ open: props.dashboardSettingsOpen }}
              type="button"
              title="Dashboard Settings"
              aria-label="Dashboard settings"
              onClick={props.onToggleDashboardSettings}
            >
              <span class="dashboard-tool-icon" aria-hidden="true">
                ⚙
              </span>
            </ToolButton>
            <Show when={!props.dashboardLocked}>
              <div class="widget-menu-shell">
                <ToolButton
                  ref={props.rollbackButtonRef}
                  class="dashboard-settings-toggle"
                  classList={{ open: props.rollbackMenuOpen }}
                  type="button"
                  title="Rollback Dashboard"
                  aria-label="Rollback dashboard"
                  aria-expanded={props.rollbackMenuOpen}
                  disabled={props.rollbackBusy}
                  onClick={props.onToggleRollbackMenu}
                >
                  <span class="dashboard-tool-icon" aria-hidden="true">
                    ↺
                  </span>
                </ToolButton>
                <MenuDropdown
                  ref={props.rollbackMenuRef}
                  class="widget-menu-dropdown"
                  open={props.rollbackMenuOpen}
                  role="menu"
                  aria-label="Rollback versions"
                >
                  <Show
                    when={props.rollbackVersions.length > 0}
                    fallback={
                      <div class="widget-menu-item disabled" role="menuitem" aria-disabled="true">
                        No versions available
                      </div>
                    }
                  >
                    <For each={props.rollbackVersions}>
                      {(timestamp) => (
                        <button
                          class="widget-menu-item rollback-version-item"
                          type="button"
                          role="menuitem"
                          onClick={() => props.onRollbackToVersion(timestamp)}
                        >
                          {timestamp}
                        </button>
                      )}
                    </For>
                  </Show>
                </MenuDropdown>
              </div>
            </Show>
            <ToolButton
              class="dashboard-add-page-toggle"
              type="button"
              title="Expand Dashboard"
              aria-label="Add one page of grid rows"
              disabled={props.dashboardLocked}
              onClick={props.onAddGridPage}
            >
              <span class="dashboard-tool-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M12 5v14" />
                  <path d="M7 14l5 5 5-5" />
                  <rect x="4" y="4" width="16" height="4" rx="1.5" />
                </svg>
              </span>
            </ToolButton>
            <div class="widget-menu-shell">
              <ToolButton
                ref={props.widgetMenuButtonRef}
                class="add-widget-button"
                classList={{ open: props.widgetMenuOpen }}
                type="button"
                title="Add Widget"
                aria-label="Add widget"
                aria-expanded={props.widgetMenuOpen}
                onClick={props.onToggleWidgetMenu}
              >
                <span aria-hidden="true">＋</span>
              </ToolButton>
              <MenuDropdown
                ref={props.widgetMenuRef}
                class="widget-menu-dropdown"
                open={props.widgetMenuOpen}
                role="menu"
                aria-label="Widget types"
              >
                <For each={props.widgetLibrary}>
                  {(widget) => (
                    <>
                      <Show when={widget.id === "donutChart" || widget.id === "mapNetwork"}>
                        <div class="widget-menu-separator" role="separator" aria-hidden="true" />
                      </Show>
                      <button
                        class="widget-menu-item"
                        classList={{ disabled: props.dashboardLocked }}
                        type="button"
                        role="menuitem"
                        draggable={!props.dashboardLocked}
                        onPointerDown={() => props.onLibraryPointerDown(widget.id)}
                        onDragStart={(event) => props.onLibraryDragStart(event, widget.id)}
                        onDragEnd={props.onLibraryDragEnd}
                        onClick={() => props.onAddWidgetFromMenu(widget.id)}
                      >
                        <span class="widget-menu-item-icon" aria-hidden="true">
                          {props.widgetTypeIcon(widget.id)}
                        </span>
                        <span class="widget-menu-item-label">{widget.label}</span>
                      </button>
                    </>
                  )}
                </For>
              </MenuDropdown>
            </div>
          </div>
          <ToolButton
            class="dashboard-lock-toggle"
            classList={{ editable: !props.dashboardLocked }}
            type="button"
            title={props.dashboardLocked ? "Unlock dashboard" : "Lock dashboard"}
            aria-label={props.dashboardLocked ? "Unlock dashboard" : "Lock dashboard"}
            onClick={props.onToggleDashboardLocked}
          >
            <span class="dashboard-tool-icon" aria-hidden="true">
              {props.dashboardLocked ? (
                <svg viewBox="0 0 24 24">
                  <rect x="5" y="11" width="14" height="10" rx="2" />
                  <path d="M8 11V8a4 4 0 1 1 8 0v3" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24">
                  <rect x="5" y="11" width="14" height="10" rx="2" />
                  <path d="M8 11V8a4 4 0 0 1 7.3-2.2" />
                  <path d="M17.2 5.8l2.2 2.2" />
                </svg>
              )}
            </span>
          </ToolButton>
          <div class="dashboard-breakpoint-tools">
            <div class="breakpoint-menu-shell">
              <ToolButton
                ref={props.breakpointMenuButtonRef}
                class="breakpoint-toggle tool-switcher-button"
                classList={{ open: props.breakpointMenuOpen }}
                type="button"
                title="Breakpoints"
                aria-label="Breakpoints"
                aria-expanded={props.breakpointMenuOpen}
                onClick={props.onToggleBreakpointMenu}
              >
                <span class="tool-switcher-icon" aria-hidden="true">
                  <svg viewBox="0 0 16 16">
                    <path d="M4 5.25L8 9l4-3.75" />
                    <path d="M4 8.25L8 12l4-3.75" />
                  </svg>
                </span>
                {props.selectedBreakpointLabel}
              </ToolButton>
              <MenuDropdown
                ref={props.breakpointMenuRef}
                class="breakpoint-menu-dropdown"
                open={props.breakpointMenuOpen}
                role="menu"
                aria-label="Select breakpoint"
              >
                <For each={props.dashboardLocked ? props.enabledBreakpointOptions : BREAKPOINT_OPTIONS}>
                  {(option) => (
                    <div
                      class="breakpoint-menu-item"
                      classList={{
                        active: props.selectedBreakpoint === option.id,
                        disabled: !props.isBreakpointEnabledForActiveDashboard(option.id)
                      }}
                      role="menuitem"
                      onClick={() => {
                        if (!props.isBreakpointEnabledForActiveDashboard(option.id)) return;
                        props.onSelectBreakpoint(option.id);
                      }}
                    >
                      <Show when={!props.dashboardLocked}>
                        <label class="breakpoint-menu-item-toggle" onClick={(event) => event.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={props.isBreakpointEnabledForActiveDashboard(option.id)}
                            onChange={(event) =>
                              props.onSetDashboardBreakpointEnabled(option.id, event.currentTarget.checked)
                            }
                          />
                        </label>
                      </Show>
                      <span>{option.label}</span>
                    </div>
                  )}
                </For>
              </MenuDropdown>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
