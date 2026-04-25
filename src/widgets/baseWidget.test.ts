import { describe, expect, it } from "vitest";
import { BaseWidget, clamp, type WidgetState } from "./baseWidget";

type TestConfig = { label: string; size: number };

class TestWidget extends BaseWidget<"testWidget", TestConfig> {
  constructor(state: WidgetState<"testWidget", TestConfig>) {
    super(state);
  }

  protected instantiate(state: WidgetState<"testWidget", TestConfig>): this {
    return new TestWidget(state) as this;
  }
}

function createWidget(): TestWidget {
  return new TestWidget({
    id: "w1",
    type: "testWidget",
    colStart: 3,
    rowStart: 4,
    colSpan: 6,
    rowSpan: 5,
    config: { label: "Alpha", size: 10 }
  });
}

describe("baseWidget", () => {
  it("clamps scalar values inside bounds", () => {
    expect(clamp(5, 1, 10)).toBe(5);
    expect(clamp(-3, 1, 10)).toBe(1);
    expect(clamp(99, 1, 10)).toBe(10);
  });

  it("applies immutable state and config patches", () => {
    const widget = createWidget();
    const patched = widget.withPatch({ colStart: 8 });
    const configPatched = widget.withConfigPatch({ label: "Beta" });

    expect(patched.colStart).toBe(8);
    expect(widget.colStart).toBe(3);
    expect(configPatched.config.label).toBe("Beta");
    expect(widget.config.label).toBe("Alpha");
  });

  it("clamps geometry to stay inside grid", () => {
    const widget = createWidget().withPatch({ colStart: 99, rowStart: 99, colSpan: 20, rowSpan: 20 });
    const clamped = widget.clampToGrid(12, 8, 2);

    expect(clamped.colSpan).toBeLessThanOrEqual(12);
    expect(clamped.rowSpan).toBeLessThanOrEqual(8);
    expect(clamped.colStart).toBeGreaterThanOrEqual(1);
    expect(clamped.rowStart).toBeGreaterThanOrEqual(1);
  });

  it("remaps placement when grid step changes", () => {
    const widget = createWidget();
    const remapped = widget.remapByStep(10, 20, 12, 8, 2);

    expect(remapped.colSpan).toBeGreaterThanOrEqual(2);
    expect(remapped.rowSpan).toBeGreaterThanOrEqual(2);
    expect(remapped.colStart).toBeGreaterThanOrEqual(1);
    expect(remapped.rowStart).toBeGreaterThanOrEqual(1);
  });
});

