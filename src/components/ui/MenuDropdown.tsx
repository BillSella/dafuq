import type { JSX } from "solid-js";

type MenuDropdownProps = JSX.HTMLAttributes<HTMLDivElement> & {
  class?: string;
  open: boolean;
};

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
