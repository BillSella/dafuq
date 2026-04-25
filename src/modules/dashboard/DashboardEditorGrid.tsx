import type { JSX } from "solid-js";
import { DashboardEditorPane } from "../../components/layout/DashboardEditorPane";
import { WidgetCanvas } from "../../components/layout/WidgetCanvas";
import type { DashboardWidget } from "./dashboardEditorConstants";

type DashboardEditorGridProps = {
  gridShellRef: (el: HTMLDivElement | undefined) => void;
  gridRef: (el: HTMLDivElement | undefined) => void;
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
  widgetInset: number;
  dragPreview: {
    colStart: number;
    rowStart: number;
    colSpan: number;
    rowSpan: number;
    label: string;
  } | null;
  items: DashboardWidget[];
  renderItem: (widget: DashboardWidget) => JSX.Element;
};

/**
 * Dashboard grid wrapper for pane geometry and widget canvas composition.
 */
export function DashboardEditorGrid(props: DashboardEditorGridProps) {
  return (
    <DashboardEditorPane
      gridShellRef={props.gridShellRef}
      gridRef={props.gridRef}
      locked={props.locked}
      showGrid={props.showGrid}
      gridWidth={props.gridWidth}
      gridHeight={props.gridHeight}
      edgePadding={props.edgePadding}
      step={props.step}
      cellSize={props.cellSize}
      columns={props.columns}
      rows={props.rows}
      onDragOver={props.onDragOver}
      onDragEnter={props.onDragEnter}
      onDrop={props.onDrop}
      widgetInset={props.widgetInset}
      dragPreview={props.dragPreview}
    >
      <WidgetCanvas items={props.items} renderItem={props.renderItem} />
    </DashboardEditorPane>
  );
}
