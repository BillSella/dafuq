import { For, type JSX } from "solid-js";

type WidgetCanvasProps<TItem> = {
  items: readonly TItem[];
  renderItem: (item: TItem) => JSX.Element;
};

export function WidgetCanvas<TItem>(props: WidgetCanvasProps<TItem>) {
  return <For each={props.items}>{(item) => props.renderItem(item)}</For>;
}
