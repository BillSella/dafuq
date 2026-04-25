import type { JSX } from "solid-js";
import { OverlayPanel } from "./OverlayPanel";
import { VerticalDivider } from "./VerticalDivider";

type SlideDirection = "left" | "right" | "top" | "bottom";

type WidgetConfigOverlayShellProps = {
  panelRef?: JSX.HTMLAttributes<HTMLDivElement>["ref"];
  open: boolean;
  slideDirection: SlideDirection;
  top: number;
  left: number;
  width: number;
  height: number;
  children: JSX.Element;
};

/**
 * Shared shell for widget configuration overlays.
 *
 * State modification contract:
 * - Delegates open/position state control to parent props.
 * - Adds static chrome (divider + classes) around caller-provided content.
 */
export function WidgetConfigOverlayShell(props: WidgetConfigOverlayShellProps): JSX.Element {
  return (
    <OverlayPanel
      panelRef={props.panelRef}
      class="widget-config-overlay widget-settings-panel"
      open={props.open}
      slideDirection={props.slideDirection}
      top={props.top}
      left={props.left}
      width={props.width}
      height={props.height}
    >
      <VerticalDivider />
      {props.children}
    </OverlayPanel>
  );
}
