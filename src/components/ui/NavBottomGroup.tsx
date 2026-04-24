import type { JSX } from "solid-js";

type NavBottomGroupProps = {
  children: JSX.Element;
};

export function NavBottomGroup(props: NavBottomGroupProps): JSX.Element {
  return <div class="left-nav-bottom-group">{props.children}</div>;
}
