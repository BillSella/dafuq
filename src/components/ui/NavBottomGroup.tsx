import type { JSX } from "solid-js";

type NavBottomGroupProps = {
  children: JSX.Element;
};

/**
 * Layout wrapper for grouping bottom-aligned left-nav actions.
 *
 * State modification contract:
 * - This component does not own or mutate state.
 * - It is a presentational container for composition only.
 */
export function NavBottomGroup(props: NavBottomGroupProps): JSX.Element {
  return <div class="left-nav-bottom-group">{props.children}</div>;
}
