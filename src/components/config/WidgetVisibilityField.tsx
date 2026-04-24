import { For } from "solid-js";
import type { DashboardBreakpoint, DashboardWidgetDoc } from "../../dashboardStore";
import { getWidgetPlacement } from "../../dashboardStore";
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
