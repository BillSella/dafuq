import { render } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";
import { VerticalDivider } from "./VerticalDivider";

describe("VerticalDivider", () => {
  it("renders hidden decorative divider", () => {
    const view = render(() => <VerticalDivider />);
    const divider = view.container.querySelector(".widget-settings-divider");
    expect(divider).toBeInTheDocument();
    expect(divider).toHaveAttribute("aria-hidden", "true");
  });
});

