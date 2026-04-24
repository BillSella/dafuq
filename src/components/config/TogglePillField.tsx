import { PillSelector } from "../ui/PillSelector";

type TogglePillFieldProps = {
  label: string;
  ariaLabel: string;
  value: boolean;
  class?: string;
  onChange: (value: boolean) => void;
};

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
