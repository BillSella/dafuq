import { For, Show, type JSX } from "solid-js";
import type { RelativePresetId, TimeWindowState } from "../../timeWindow";
import { MenuDropdown } from "../ui/MenuDropdown";
import { ToolButton } from "../ui/ToolButton";

type NavTool = "dashboards" | "trafficAnalysis" | "help" | "settings" | "userLogin" | "userSettings";

type AppTopbarToolsProps = {
  currentClock: string;
  currentClockIso: string;
  topbarCustomTimeSpan: string;
  timeWindow: TimeWindowState;
  timeWindowMenuOpen: boolean;
  timeWindowMenuView: "list" | "custom";
  customRangeFrom: string;
  customRangeTo: string;
  relativePresets: ReadonlyArray<{ id: RelativePresetId; label: string }>;
  isAuthenticated: boolean;
  activeNavTool: NavTool;
  userMenuOpen: boolean;
  timeWindowButtonRef?: JSX.HTMLAttributes<HTMLButtonElement>["ref"];
  timeWindowMenuRef?: JSX.HTMLAttributes<HTMLDivElement>["ref"];
  userMenuButtonRef?: JSX.HTMLAttributes<HTMLButtonElement>["ref"];
  userMenuRef?: JSX.HTMLAttributes<HTMLDivElement>["ref"];
  timeWindowSummaryLabel: (timeWindow: TimeWindowState) => string;
  timeWindowButtonLabel: (timeWindow: TimeWindowState) => string;
  onToggleTimeWindowMenu: () => void;
  onSetTimeWindowListView: () => void;
  onSetTimeWindowCustomView: () => void;
  onUpdateCustomRangeFrom: (value: string) => void;
  onUpdateCustomRangeTo: (value: string) => void;
  onApplyCustomTimeWindow: () => void;
  onApplyRelativePreset: (presetId: RelativePresetId) => void;
  onToggleUserMenu: () => void;
  onOpenUserSettings: () => void;
  onToggleAuth: () => void;
};

export function AppTopbarTools(props: AppTopbarToolsProps) {
  return (
    <div class="app-topbar-tools">
      <Show
        when={props.timeWindow.kind === "absolute"}
        fallback={
          <time
            class="app-topbar-clock"
            datetime={props.currentClockIso}
            title="Local time"
            aria-label={`Current time ${props.currentClock}`}
          >
            {props.currentClock}
          </time>
        }
      >
        <span
          class="app-topbar-clock"
          title="Selected custom time range"
          aria-label={props.topbarCustomTimeSpan}
        >
          {props.topbarCustomTimeSpan}
        </span>
      </Show>
      <div class="time-window-shell">
        <ToolButton
          ref={props.timeWindowButtonRef}
          class="time-window-tool"
          classList={{ open: props.timeWindowMenuOpen }}
          type="button"
          title={props.timeWindowSummaryLabel(props.timeWindow)}
          aria-label="Time range for dashboard data"
          aria-expanded={props.timeWindowMenuOpen}
          onClick={props.onToggleTimeWindowMenu}
        >
          <span class="time-window-tool-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M12 6v6l4 2" />
              <circle cx="12" cy="12" r="9" />
            </svg>
          </span>
          <span class="time-window-tool-label">{props.timeWindowButtonLabel(props.timeWindow)}</span>
        </ToolButton>
        <MenuDropdown
          ref={props.timeWindowMenuRef}
          class="time-window-dropdown"
          open={props.timeWindowMenuOpen}
          role="menu"
          aria-label="Time range"
        >
          <Show
            when={props.timeWindowMenuView === "list"}
            fallback={
              <div class="time-window-custom">
                <button type="button" class="time-window-back" onClick={props.onSetTimeWindowListView}>
                  ← Back
                </button>
                <label class="time-window-field">
                  <span>From</span>
                  <input
                    type="datetime-local"
                    value={props.customRangeFrom}
                    onInput={(e) => props.onUpdateCustomRangeFrom(e.currentTarget.value)}
                  />
                </label>
                <label class="time-window-field">
                  <span>To</span>
                  <input
                    type="datetime-local"
                    value={props.customRangeTo}
                    onInput={(e) => props.onUpdateCustomRangeTo(e.currentTarget.value)}
                  />
                </label>
                <button type="button" class="time-window-apply" onClick={props.onApplyCustomTimeWindow}>
                  Apply
                </button>
              </div>
            }
          >
            <For each={props.relativePresets}>
              {(preset) => (
                <button
                  type="button"
                  class="time-window-item"
                  classList={{
                    active: props.timeWindow.kind === "relative" && props.timeWindow.preset === preset.id
                  }}
                  role="menuitem"
                  onClick={() => props.onApplyRelativePreset(preset.id)}
                >
                  {preset.label}
                </button>
              )}
            </For>
            <button
              type="button"
              class="time-window-item time-window-custom-trigger"
              classList={{ active: props.timeWindow.kind === "absolute" }}
              role="menuitem"
              onClick={props.onSetTimeWindowCustomView}
            >
              Custom range...
            </button>
          </Show>
        </MenuDropdown>
      </div>
      <div class="user-menu-shell">
        <ToolButton
          ref={props.userMenuButtonRef}
          class="user-tool"
          classList={{
            open: props.userMenuOpen,
            active: props.activeNavTool === "userLogin" || props.activeNavTool === "userSettings"
          }}
          type="button"
          aria-label="User menu"
          aria-expanded={props.userMenuOpen}
          onClick={props.onToggleUserMenu}
        >
          <span class="user-tool-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <circle cx="12" cy="8" r="3.5" />
              <path d="M5.5 19.5c0-3.1 2.8-5.5 6.5-5.5s6.5 2.4 6.5 5.5" />
            </svg>
          </span>
        </ToolButton>

        <MenuDropdown
          ref={props.userMenuRef}
          class="user-menu-dropdown"
          open={props.userMenuOpen}
          role="menu"
          aria-label="User actions"
        >
          <button class="user-menu-item" type="button" role="menuitem" onClick={props.onOpenUserSettings}>
            User Settings
          </button>
          <button class="user-menu-item" type="button" role="menuitem" onClick={props.onToggleAuth}>
            {props.isAuthenticated ? "Log Out" : "Log In"}
          </button>
        </MenuDropdown>
      </div>
    </div>
  );
}
