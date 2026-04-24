import type { JSX } from "solid-js";

type ToolButtonProps = JSX.ButtonHTMLAttributes<HTMLButtonElement> & {
  class?: string;
};

export function ToolButton(props: ToolButtonProps): JSX.Element {
  return (
    <button
      ref={props.ref}
      class={props.class}
      classList={props.classList}
      type={props.type}
      title={props.title}
      aria-label={props["aria-label"]}
      aria-expanded={props["aria-expanded"]}
      disabled={props.disabled}
      onClick={props.onClick}
      onPointerDown={props.onPointerDown}
      onDragStart={props.onDragStart}
      onDragEnd={props.onDragEnd}
      draggable={props.draggable}
      role={props.role}
    >
      {props.children}
    </button>
  );
}
