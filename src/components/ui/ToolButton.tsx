import type { JSX } from "solid-js";

type ToolButtonProps = JSX.ButtonHTMLAttributes<HTMLButtonElement> & {
  class?: string;
};

/**
 * Base clickable control for topbar and dashboard tool actions.
 *
 * State modification contract:
 * - This primitive does not own state.
 * - State changes occur only through callback props provided by parent layers.
 *
 * Significant decision:
 * - Keep explicit passthrough for commonly used accessibility and interaction
 *   props to preserve consistent semantics across tool controls.
 */
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
