import type { JSX } from "solid-js";

type NavToolButtonProps = {
  active: boolean;
  title: string;
  label: string;
  icon: JSX.Element;
  onClick: () => void;
  class?: string;
  showNativeTooltip?: boolean;
  blocked?: boolean;
};

export function NavToolButton(props: NavToolButtonProps): JSX.Element {
  const blocked = () => !!props.blocked;

  return (
    <button
      class={`nav-tool${props.class ? ` ${props.class}` : ""}`}
      classList={{ active: props.active, blocked: blocked() }}
      type="button"
      title={props.showNativeTooltip === false ? undefined : props.title}
      aria-label={props.label}
      aria-disabled={blocked()}
      onClick={() => {
        if (blocked()) return;
        props.onClick();
      }}
    >
      <span class="nav-icon nav-icon-default" aria-hidden="true">
        {props.icon}
      </span>
      <span class="nav-icon nav-tool-lock" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <rect x="5" y="11" width="14" height="10" rx="2" />
          <path d="M8 11V8a4 4 0 1 1 8 0v3" />
        </svg>
      </span>
      <span class="nav-label">{props.label}</span>
    </button>
  );
}
