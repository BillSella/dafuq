import type { JSX } from "solid-js";

/**
 * Visual separator used inside widget settings panes.
 *
 * State modification contract:
 * - Pure presentational component.
 * - No local state ownership or mutation paths.
 */
export function VerticalDivider(): JSX.Element {
  return <div class="widget-settings-divider" aria-hidden="true" />;
}
