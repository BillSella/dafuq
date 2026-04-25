import { describe, expect, it } from "vitest";
import {
  BREAKPOINT_IDS,
  detectBreakpointFromViewport,
  getGridSizeForBreakpoint,
  projectPlacementAcrossBreakpoints
} from "./layoutService";

describe("layoutService", () => {
  it("computes grid size with minimum step guard", () => {
    const tiny = getGridSizeForBreakpoint("desktopFhd", 10, 10);
    expect(tiny.columns).toBe(16);
    expect(tiny.rows).toBe(9);
    expect(tiny.step).toBe(6);
  });

  it("detects expected breakpoints from viewport ranges", () => {
    expect(detectBreakpointFromViewport(8000, 4000)).toBe("uhd8k");
    expect(detectBreakpointFromViewport(4000, 3000)).toBe("uhd4k");
    expect(detectBreakpointFromViewport(3000, 2000)).toBe("qhd2k");
    expect(detectBreakpointFromViewport(2000, 1200)).toBe("desktopFhd");
    expect(detectBreakpointFromViewport(1400, 900)).toBe("laptopWxga");
    expect(detectBreakpointFromViewport(900, 500)).toBe("tabletLandscape");
    expect(detectBreakpointFromViewport(800, 1200)).toBe("tabletPortrait");
    expect(detectBreakpointFromViewport(700, 300)).toBe("mobileLandscape");
    expect(detectBreakpointFromViewport(300, 700)).toBe("mobilePortrait");
  });

  it("projects placement across all breakpoints and preserves active breakpoint", () => {
    const projected = projectPlacementAcrossBreakpoints(
      "desktopFhd",
      { colStart: 4, rowStart: 3, colSpan: 6, rowSpan: 4 },
      1920,
      1080
    );

    expect(projected).toHaveLength(BREAKPOINT_IDS.length);
    const active = projected.find((p) => p.breakpoint === "desktopFhd");
    expect(active).toEqual({
      breakpoint: "desktopFhd",
      colStart: 4,
      rowStart: 3,
      colSpan: 6,
      rowSpan: 4,
      visible: true
    });

    projected.forEach((placement) => {
      expect(placement.colStart).toBeGreaterThanOrEqual(1);
      expect(placement.rowStart).toBeGreaterThanOrEqual(1);
      expect(placement.colSpan).toBeGreaterThanOrEqual(1);
      expect(placement.rowSpan).toBeGreaterThanOrEqual(1);
      expect(placement.visible).toBe(true);
    });
  });
});

