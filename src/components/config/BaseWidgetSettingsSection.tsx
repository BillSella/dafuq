import type { JSX } from "solid-js";
import type { DashboardBreakpoint, DashboardWidgetDoc } from "../../dashboardStore";
import { LabelFieldRow } from "../ui/LabelFieldRow";
import { PillSelector } from "../ui/PillSelector";
import { WidgetVisibilityField } from "./WidgetVisibilityField";

type BreakpointOption = { id: DashboardBreakpoint; label: string };

type BaseWidgetSettingsSectionProps = {
  widgetDoc: DashboardWidgetDoc | null;
  breakpointOptions: BreakpointOption[];
  visibilityOpen: boolean;
  onToggleVisibilityOpen: () => void;
  onVisibilityChange: (breakpoint: DashboardBreakpoint, visible: boolean) => void;
  visibilityMenuRef?: JSX.HTMLAttributes<HTMLDivElement>["ref"];
  visibilityButtonRef?: JSX.HTMLAttributes<HTMLButtonElement>["ref"];
  label: string;
  onLabelChange: (value: string) => void;
  align: "left" | "center" | "right";
  onAlignChange: (value: "left" | "center" | "right") => void;
  fontSize: "small" | "medium" | "large";
  onFontSizeChange: (value: "small" | "medium" | "large") => void;
};

/**
 * Shared display-settings block used by widget configuration forms.
 *
 * State modification contract:
 * - Source of truth: all field values and visibility menu state are parent-owned.
 * - Mutation paths: emits visibility, label, font-size, and alignment changes
 *   through callbacks.
 */
export function BaseWidgetSettingsSection(props: BaseWidgetSettingsSectionProps): JSX.Element {
  return (
    <>
      <div class="display-settings-title">Display Settings</div>
      <WidgetVisibilityField
        widgetDoc={props.widgetDoc}
        options={props.breakpointOptions}
        open={props.visibilityOpen}
        menuRef={props.visibilityMenuRef}
        buttonRef={props.visibilityButtonRef}
        onToggleOpen={props.onToggleVisibilityOpen}
        onChange={props.onVisibilityChange}
      />
      <LabelFieldRow label="Label" class="section-gap-top">
        <input
          type="text"
          value={props.label}
          onInput={(event) => props.onLabelChange(event.currentTarget.value)}
        />
      </LabelFieldRow>
      <LabelFieldRow label="Font Size">
        <select
          value={props.fontSize}
          onChange={(event) =>
            props.onFontSizeChange(event.currentTarget.value as "small" | "medium" | "large")
          }
        >
          <option value="small">Small</option>
          <option value="medium">Medium</option>
          <option value="large">Large</option>
        </select>
      </LabelFieldRow>
      <LabelFieldRow label="Align">
        <PillSelector
          ariaLabel="Widget alignment"
          selected={props.align}
          options={[
            { value: "left", label: "Left" },
            { value: "center", label: "Center" },
            { value: "right", label: "Right" }
          ]}
          onSelect={props.onAlignChange}
        />
      </LabelFieldRow>
      <div class="base-settings-separator" />
    </>
  );
}
