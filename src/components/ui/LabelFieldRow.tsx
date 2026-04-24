import type { JSX } from "solid-js";

type LabelFieldRowProps = {
  label: string;
  class?: string;
  children: JSX.Element;
};

export function LabelFieldRow(props: LabelFieldRowProps): JSX.Element {
  return (
    <label class={`field${props.class ? ` ${props.class}` : ""}`}>
      <span>{props.label}</span>
      {props.children}
    </label>
  );
}
