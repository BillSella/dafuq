import { For } from "solid-js";
import type { DashboardBreakpoint, DashboardWidgetDoc } from "../../modules/dashboard/dashboardStore";
import { getWidgetPlacement } from "../../modules/dashboard/dashboardStore";
import type { JSX } from "solid-js";
import { MenuDropdown } from "../ui/MenuDropdown";
import { ToolButton } from "../ui/ToolButton";

type BreakpointOption = { id: DashboardBreakpoint; label: string };

type WidgetVisibilityFieldProps = {
  widgetDoc: DashboardWidgetDoc | null;
  options: BreakpointOption[];
  open: boolean;
  onToggleOpen: () => void;
  onChange: (breakpoint: DashboardBreakpoint, visible: boolean) => void;
  menuRef?: JSX.HTMLAttributes<HTMLDivElement>["ref"];
  buttonRef?: JSX.HTMLAttributes<HTMLButtonElement>["ref"];
};

/**
 * Breakpoint-level visibility control menu for a single widget.
 *
 * State modification contract:
 * - Source of truth: visibility values come from `widgetDoc` placements.
 * - Mutation path: checkbox changes emit `(breakpoint, visible)` through `onChange`.
 * - Menu open state is externally controlled by `open` + `onToggleOpen`.
 */
export function WidgetVisibilityField(props: WidgetVisibilityFieldProps): JSX.Element {
  const enabledCount = () =>
    props.options.filter((option) => {
      const doc = props.widgetDoc;
      if (!doc) return false;
      return getWidgetPlacement(doc, option.id).visible;
    }).length;

  return (
    <label class="field">
      <span>Visibility</span>
      <div class="visibility-menu-shell">
        <ToolButton
          ref={props.buttonRef}
          class="visibility-toggle"
          classList={{ open: props.open }}
          type="button"
          onClick={props.onToggleOpen}
        >
          {enabledCount()} / {props.options.length} enabled
        </ToolButton>
        <MenuDropdown ref={props.menuRef} class="visibility-menu-dropdown" open={props.open}>
          <For each={props.options}>
            {(option) => (
              <label class="visibility-item">
                <input
                  type="checkbox"
                  checked={props.widgetDoc ? getWidgetPlacement(props.widgetDoc, option.id).visible : true}
                  onChange={(event) => props.onChange(option.id, event.currentTarget.checked)}
                />
                <span>{option.label}</span>
              </label>
            )}
          </For>
        </MenuDropdown>
      </div>
    </label>
  );
}
