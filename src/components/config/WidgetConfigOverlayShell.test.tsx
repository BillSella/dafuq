import { render } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";
import { WidgetConfigOverlayShell } from "./WidgetConfigOverlayShell";

describe("WidgetConfigOverlayShell", () => {
  it("renders overlay classes, divider, and child content", () => {
    const view = render(() => (
      <WidgetConfigOverlayShell
        panelRef={() => undefined}
        open={true}
        slideDirection="left"
        top={10}
        left={20}
        width={300}
        height={400}
      >
        <section data-testid="inner-content">Settings Body</section>
      </WidgetConfigOverlayShell>
    ));

    const panel = view.container.querySelector(".widget-config-overlay.widget-settings-panel");
    expect(panel).toBeInTheDocument();
    expect(panel).toHaveClass("open");
    expect(panel).toHaveClass("slide-left");
    expect(view.container.querySelector(".widget-settings-divider")).toBeInTheDocument();
    expect(view.container.querySelector("[data-testid='inner-content']")).toBeInTheDocument();
  });
});

