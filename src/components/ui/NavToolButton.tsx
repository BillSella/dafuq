import type { JSX } from "solid-js";

type NavToolButtonProps = {
  active: boolean;
  title: string;
  label: string;
  icon: JSX.Element;
  onClick: () => void;
  class?: string;
  showNativeTooltip?: boolean;
};

export function NavToolButton(props: NavToolButtonProps): JSX.Element {
  return (
    <button
      class={`nav-tool${props.class ? ` ${props.class}` : ""}`}
      classList={{ active: props.active }}
      type="button"
      title={props.showNativeTooltip === false ? undefined : props.title}
      aria-label={props.label}
      onClick={props.onClick}
    >
      <span class="nav-icon" aria-hidden="true">
        {props.icon}
      </span>
      <span class="nav-label">{props.label}</span>
    </button>
  );
}
