import { For, type JSX } from "solid-js";

type WidgetCanvasProps<TItem> = {
  items: readonly TItem[];
  renderItem: (item: TItem) => JSX.Element;
};

/**
 * Generic item-to-view adapter for widget collections.
 *
 * State modification contract:
 * - This component is pure render composition.
 * - It does not own or mutate state, and delegates item rendering to `renderItem`.
 */
export function WidgetCanvas<TItem>(props: WidgetCanvasProps<TItem>) {
  return <For each={props.items}>{(item) => props.renderItem(item)}</For>;
}
