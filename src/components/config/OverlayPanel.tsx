import type { JSX } from "solid-js";

type SlideDirection = "left" | "right" | "top" | "bottom";

type OverlayPanelProps = {
  panelRef?: JSX.HTMLAttributes<HTMLDivElement>["ref"];
  class: string;
  open: boolean;
  slideDirection: SlideDirection;
  top: number;
  left: number;
  width: number;
  height: number;
  children: JSX.Element;
};

export function OverlayPanel(props: OverlayPanelProps): JSX.Element {
  return (
    <div
      ref={props.panelRef}
      class={props.class}
      classList={{
        open: props.open,
        "slide-right": props.slideDirection === "right",
        "slide-left": props.slideDirection === "left",
        "slide-top": props.slideDirection === "top",
        "slide-bottom": props.slideDirection === "bottom"
      }}
      style={{
        top: `${props.top}px`,
        left: `${props.left}px`,
        width: `${props.width}px`,
        height: `${props.height}px`
      }}
    >
      {props.children}
    </div>
  );
}
