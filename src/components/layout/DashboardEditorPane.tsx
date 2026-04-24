import type { JSX } from "solid-js";

type DashboardEditorPaneProps = {
  gridShellRef?: JSX.HTMLAttributes<HTMLDivElement>["ref"];
  gridRef?: JSX.HTMLAttributes<HTMLDivElement>["ref"];
  locked: boolean;
  showGrid: boolean;
  gridWidth: number;
  gridHeight: number;
  edgePadding: number;
  step: number;
  cellSize: number;
  columns: number;
  rows: number;
  onDragOver: JSX.EventHandler<HTMLDivElement, DragEvent>;
  onDragEnter: JSX.EventHandler<HTMLDivElement, DragEvent>;
  onDrop: JSX.EventHandler<HTMLDivElement, DragEvent>;
  dragPreview: {
    colStart: number;
    rowStart: number;
    colSpan: number;
    rowSpan: number;
    label: string;
  } | null;
  widgetInset: number;
  children: JSX.Element;
};

export function DashboardEditorPane(props: DashboardEditorPaneProps) {
  return (
    <div class="dashboard-editor">
      <section class="editor-grid-area">
        <div ref={props.gridShellRef} class="grid-widget-shell">
          <div
            ref={props.gridRef}
            class="grid-widget"
            classList={{
              locked: props.locked,
              "show-grid": props.showGrid
            }}
            style={{
              width: `${props.gridWidth}px`,
              height: `${props.gridHeight}px`,
              padding: `${props.edgePadding}px`,
              "--grid-step": `${props.step}px`,
              "grid-template-columns": `repeat(${props.columns}, ${props.cellSize}px)`,
              "grid-template-rows": `repeat(${props.rows}, ${props.cellSize}px)`
            }}
            onDragOver={props.onDragOver}
            onDragEnter={props.onDragEnter}
            onDrop={props.onDrop}
          >
            <div
              class="drop-ghost"
              classList={{ visible: !!props.dragPreview }}
              style={{
                left: `${((props.dragPreview?.colStart ?? 1) - 1) * props.step + props.widgetInset}px`,
                top: `${((props.dragPreview?.rowStart ?? 1) - 1) * props.step + props.widgetInset}px`,
                width: `${Math.max(1, (props.dragPreview?.colSpan ?? 1) * props.step - props.widgetInset * 2)}px`,
                height: `${Math.max(1, (props.dragPreview?.rowSpan ?? 1) * props.step - props.widgetInset * 2)}px`
              }}
            >
              <span>Drop {props.dragPreview?.label ?? "Widget"}</span>
            </div>
            {props.children}
          </div>
        </div>
      </section>
    </div>
  );
}
