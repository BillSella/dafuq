import type { JSX } from "solid-js";

type MenuDropdownProps = JSX.HTMLAttributes<HTMLDivElement> & {
  class?: string;
  open: boolean;
};

/**
 * Shared dropdown container primitive for menu-style popovers.
 *
 * State modification contract:
 * - Source of truth for open/closed state is external.
 * - This component only reflects `open` in class state and renders children.
 */
export function MenuDropdown(props: MenuDropdownProps): JSX.Element {
  return (
    <div
      ref={props.ref}
      class={props.class}
      classList={{ ...(props.classList ?? {}), open: props.open }}
      role={props.role}
      aria-label={props["aria-label"]}
    >
      {props.children}
    </div>
  );
}
