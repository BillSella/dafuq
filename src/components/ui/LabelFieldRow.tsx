import type { JSX } from "solid-js";

type LabelFieldRowProps = {
  label: string;
  class?: string;
  children: JSX.Element;
};

/**
 * Form row primitive that pairs label text with a field control.
 *
 * State modification contract:
 * - Presentational wrapper only; does not own or mutate field state.
 * - Child control state is managed externally by caller.
 */
export function LabelFieldRow(props: LabelFieldRowProps): JSX.Element {
  return (
    <label class={`field${props.class ? ` ${props.class}` : ""}`}>
      <span>{props.label}</span>
      {props.children}
    </label>
  );
}
