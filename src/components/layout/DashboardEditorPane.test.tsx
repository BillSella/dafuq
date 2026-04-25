import { fireEvent, render, screen, within } from "@solidjs/testing-library";
import { describe, expect, it, vi } from "vitest";
import { DashboardEditorPane } from "./DashboardEditorPane";

describe("DashboardEditorPane", () => {
  it("renders grid shell with sizing and lock/show-grid class state", () => {
    const onDragOver = vi.fn();
    const onDragEnter = vi.fn();
    const onDrop = vi.fn();
    const view = render(() => (
      <DashboardEditorPane
        locked
        showGrid
        gridWidth={640}
        gridHeight={360}
        edgePadding={6}
        step={20}
        cellSize={18}
        columns={10}
        rows={6}
        onDragOver={onDragOver}
        onDragEnter={onDragEnter}
        onDrop={onDrop}
        widgetInset={1}
        dragPreview={null}
      >
        <div data-testid="child-node">child</div>
      </DashboardEditorPane>
    ));

    const local = within(view.container);
    const grid = local.getByTestId("child-node").closest(".grid-widget");
    expect(grid).toBeInTheDocument();
    expect(grid?.classList.contains("locked")).toBe(true);
    expect(grid?.classList.contains("show-grid")).toBe(true);
    expect(grid).toHaveStyle({ width: "640px", height: "360px", padding: "6px" });
    expect(grid).toHaveStyle({ "grid-template-columns": "repeat(10, 18px)" });
    expect(grid).toHaveStyle({ "grid-template-rows": "repeat(6, 18px)" });
  });

  it("routes drag events and renders visible drop ghost when preview exists", async () => {
    const onDragOver = vi.fn();
    const onDragEnter = vi.fn();
    const onDrop = vi.fn();
    const view = render(() => (
      <DashboardEditorPane
        locked={false}
        showGrid={false}
        gridWidth={500}
        gridHeight={300}
        edgePadding={4}
        step={16}
        cellSize={14}
        columns={8}
        rows={5}
        onDragOver={onDragOver}
        onDragEnter={onDragEnter}
        onDrop={onDrop}
        widgetInset={2}
        dragPreview={{ colStart: 2, rowStart: 3, colSpan: 2, rowSpan: 1, label: "Gauge" }}
      >
        <div>content</div>
      </DashboardEditorPane>
    ));

    const local = within(view.container);
    const grid = view.container.querySelector(".grid-widget");
    expect(grid).toBeInTheDocument();

    const ghost = view.container.querySelector(".drop-ghost");
    expect(ghost?.classList.contains("visible")).toBe(true);
    expect(screen.getByText("Drop Gauge")).toBeInTheDocument();

    await fireEvent.dragOver(grid!);
    await fireEvent.dragEnter(grid!);
    await fireEvent.drop(grid!);
    expect(onDragOver).toHaveBeenCalledTimes(1);
    expect(onDragEnter).toHaveBeenCalledTimes(1);
    expect(onDrop).toHaveBeenCalledTimes(1);

    expect(local.getByText("content")).toBeInTheDocument();
  });
});

