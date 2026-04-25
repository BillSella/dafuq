import { render, screen } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";
import { WidgetCanvas } from "./WidgetCanvas";

describe("WidgetCanvas", () => {
  it("renders all items using provided render function", () => {
    const items = ["alpha", "beta", "gamma"];
    render(() => (
      <WidgetCanvas
        items={items}
        renderItem={(item) => <div data-testid="canvas-item">{item}</div>}
      />
    ));

    const rendered = screen.getAllByTestId("canvas-item");
    expect(rendered).toHaveLength(3);
    expect(rendered.map((node) => node.textContent)).toEqual(items);
  });
});

