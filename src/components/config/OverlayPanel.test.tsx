import { render } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";
import { OverlayPanel } from "./OverlayPanel";

describe("OverlayPanel", () => {
  it("applies open and slide classes with px sizing styles", () => {
    const view = render(() => (
      <OverlayPanel
        class="test-overlay"
        open={true}
        slideDirection="right"
        top={12}
        left={34}
        width={560}
        height={240}
      >
        <div>Panel Content</div>
      </OverlayPanel>
    ));

    const panel = view.container.querySelector(".test-overlay");
    expect(panel).toBeInTheDocument();
    expect(panel).toHaveClass("open");
    expect(panel).toHaveClass("slide-right");
    expect(panel).toHaveStyle({
      top: "12px",
      left: "34px",
      width: "560px",
      height: "240px"
    });
  });

  it("switches directional class for alternate slide direction", () => {
    const view = render(() => (
      <OverlayPanel
        class="test-overlay"
        open={false}
        slideDirection="bottom"
        top={0}
        left={0}
        width={100}
        height={50}
      >
        <div>Panel Content</div>
      </OverlayPanel>
    ));

    const panel = view.container.querySelector(".test-overlay");
    expect(panel).toHaveClass("slide-bottom");
    expect(panel).not.toHaveClass("open");
  });
});

