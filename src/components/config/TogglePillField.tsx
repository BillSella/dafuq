import { PillSelector } from "../ui/PillSelector";

type TogglePillFieldProps = {
  label: string;
  ariaLabel: string;
  value: boolean;
  class?: string;
  onChange: (value: boolean) => void;
};

/**
 * Boolean settings field that wraps `PillSelector` with On/Off options.
 *
 * State modification contract:
 * - Source of truth: parent-controlled `value` prop.
 * - Mutation path: emits normalized boolean values via `onChange`.
 */
export function TogglePillField(props: TogglePillFieldProps) {
  return (
    <fieldset class={`field fieldset ${props.class ?? ""}`.trim()}>
      <span>{props.label}</span>
      <PillSelector
        ariaLabel={props.ariaLabel}
        selected={props.value ? "on" : "off"}
        options={[
          { value: "on", label: "On" },
          { value: "off", label: "Off" }
        ]}
        onSelect={(option) => props.onChange(option === "on")}
      />
    </fieldset>
  );
}
