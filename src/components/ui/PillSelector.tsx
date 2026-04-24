import type { JSX } from "solid-js";

type PillOption<T extends string | number> = {
  value: T;
  label: string;
};

type PillSelectorProps<T extends string | number> = {
  options: readonly PillOption<T>[];
  selected: T;
  ariaLabel: string;
  onSelect: (value: T) => void;
};

export function PillSelector<T extends string | number>(props: PillSelectorProps<T>): JSX.Element {
  return (
    <div class="pill-group" role="radiogroup" aria-label={props.ariaLabel}>
      {props.options.map((option) => (
        <button
          type="button"
          role="radio"
          aria-checked={props.selected === option.value}
          class="pill-option"
          classList={{ selected: props.selected === option.value }}
          onClick={() => props.onSelect(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
