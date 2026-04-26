import { clamp } from "../../widgets/baseWidget";
import { DEFAULT_WIDGET_TYPE, type WidgetType } from "../../widgets/widgetRegistry";
import type { DashboardWidget, SlideDirection } from "./dashboardEditorConstants";
import type { Accessor, Setter } from "solid-js";

type UseDashboardInteractionsOptions = {
  dashboardLocked: Accessor<boolean>;
  bumpDebug: (eventName: string, payload?: unknown) => void;
  draggingLibraryType: Accessor<WidgetType | null>;
  setDraggingLibraryType: Setter<WidgetType | null>;
  setDragPreview: Setter<
    | {
        type: WidgetType;
        colStart: number;
        rowStart: number;
        colSpan: number;
        rowSpan: number;
      }
    | null
  >;
  dragPreview: Accessor<
    | {
        type: WidgetType;
        colStart: number;
        rowStart: number;
        colSpan: number;
        rowSpan: number;
      }
    | null
  >;
  getWidgetFootprintForCurrentGrid: (type: WidgetType) => { colSpan: number; rowSpan: number };
  addWidgetAt: (type: WidgetType, col: number, row: number) => void;
  columns: Accessor<number>;
  rows: Accessor<number>;
  step: Accessor<number>;
  gridRef: Accessor<HTMLDivElement | undefined>;
  configWidgetId: Accessor<string | null>;
  setConfigWidgetId: Setter<string | null>;
  interaction: Accessor<{ id: string; mode: "dragging" | "resizing" } | null>;
  setInteraction: Setter<{ id: string; mode: "dragging" | "resizing" } | null>;
  updateWidget: (id: string, patch: { colStart?: number; rowStart?: number; colSpan?: number; rowSpan?: number }) => void;
  updatePanelPlacement: () => void;
  libraryWidgetKey: string;
};

/**
 * Drag/drop and pointer interactions for adding, moving, and resizing widgets.
 */
export function useDashboardInteractions(options: UseDashboardInteractionsOptions) {
  const detectDraggedLibraryType = (event: DragEvent): WidgetType | null => {
    const active = options.draggingLibraryType();
    if (active) return active;
    const transferType = event.dataTransfer?.getData(options.libraryWidgetKey) as WidgetType | "";
    if (transferType) return transferType;
    const hasLibraryType = event.dataTransfer?.types?.includes(options.libraryWidgetKey);
    return hasLibraryType ? DEFAULT_WIDGET_TYPE : null;
  };

  const getCellFromPointer = (clientX: number, clientY: number) => {
    const gridRef = options.gridRef();
    if (!gridRef) return { col: 1, row: 1 };
    const rect = gridRef.getBoundingClientRect();
    const x = clamp(clientX - rect.left, 0, rect.width - 1);
    const y = clamp(clientY - rect.top, 0, rect.height - 1);
    return {
      col: clamp(Math.floor(x / options.step()) + 1, 1, options.columns()),
      row: clamp(Math.floor(y / options.step()) + 1, 1, options.rows())
    };
  };

  const onLibraryDragStart = (event: DragEvent, type: WidgetType) => {
    if (options.dashboardLocked()) return;
    options.bumpDebug("onLibraryDragStart", { type });
    if (!event.dataTransfer) return;
    event.dataTransfer.setData(options.libraryWidgetKey, type);
    event.dataTransfer.effectAllowed = "copy";
    options.setDraggingLibraryType(type);
    const previewSeed = options.getWidgetFootprintForCurrentGrid(type);
    options.setDragPreview({
      type,
      colStart: 1,
      rowStart: 1,
      colSpan: previewSeed.colSpan,
      rowSpan: previewSeed.rowSpan
    });
  };

  const handleGridDrop = (event: DragEvent) => {
    if (options.dashboardLocked()) return;
    options.bumpDebug("handleGridDrop");
    event.preventDefault();
    const type = detectDraggedLibraryType(event) ?? "";
    if (!type) return;
    const preview = options.dragPreview();
    if (preview) {
      options.addWidgetAt(type, preview.colStart, preview.rowStart);
    } else {
      const cell = getCellFromPointer(event.clientX, event.clientY);
      options.addWidgetAt(type, cell.col, cell.row);
    }
    options.setDragPreview(null);
    options.setDraggingLibraryType(null);
  };

  const handleGridDragOver = (event: DragEvent) => {
    if (options.dashboardLocked()) return;
    options.bumpDebug("handleGridDragOver");
    const type = detectDraggedLibraryType(event);
    if (!type) return;
    if (!options.draggingLibraryType()) options.setDraggingLibraryType(type);
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    const cell = getCellFromPointer(event.clientX, event.clientY);
    const previewSeed = options.getWidgetFootprintForCurrentGrid(type);
    const colSpan = previewSeed.colSpan;
    const rowSpan = previewSeed.rowSpan;
    options.setDragPreview({
      type,
      colStart: clamp(cell.col, 1, options.columns() - colSpan + 1),
      rowStart: clamp(cell.row, 1, options.rows() - rowSpan + 1),
      colSpan,
      rowSpan
    });
  };

  const startWidgetDrag = (event: PointerEvent, widget: DashboardWidget) => {
    if (options.dashboardLocked()) return;
    options.bumpDebug("startWidgetDrag", { id: widget.id });
    if (options.configWidgetId() === widget.id) {
      options.setConfigWidgetId(null);
      return;
    }
    event.preventDefault();
    const pointerStartX = event.clientX;
    const pointerStartY = event.clientY;
    const initialCol = widget.colStart;
    const initialRow = widget.rowStart;
    options.setInteraction({ id: widget.id, mode: "dragging" });

    const onMove = (moveEvent: PointerEvent) => {
      const colDelta = Math.round((moveEvent.clientX - pointerStartX) / options.step());
      const rowDelta = Math.round((moveEvent.clientY - pointerStartY) / options.step());
      const maxCol = options.columns() - widget.colSpan + 1;
      const maxRow = options.rows() - widget.rowSpan + 1;
      options.updateWidget(widget.id, {
        colStart: clamp(initialCol + colDelta, 1, maxCol),
        rowStart: clamp(initialRow + rowDelta, 1, maxRow)
      });
      options.updatePanelPlacement();
    };
    const onUp = () => {
      options.setInteraction(null);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      window.removeEventListener("blur", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    window.addEventListener("blur", onUp);
  };

  const startWidgetResize = (event: PointerEvent, widget: DashboardWidget) => {
    if (options.dashboardLocked()) return;
    options.bumpDebug("startWidgetResize", { id: widget.id });
    event.preventDefault();
    event.stopPropagation();
    const pointerStartX = event.clientX;
    const pointerStartY = event.clientY;
    const initialColSpan = widget.colSpan;
    const initialRowSpan = widget.rowSpan;
    options.setInteraction({ id: widget.id, mode: "resizing" });

    const onMove = (moveEvent: PointerEvent) => {
      const colDelta = Math.round((moveEvent.clientX - pointerStartX) / options.step());
      const rowDelta = Math.round((moveEvent.clientY - pointerStartY) / options.step());
      const minSpanX = Math.max(1, Math.ceil(16 / options.step()));
      const minSpanY = Math.max(1, Math.ceil(16 / options.step()));
      const maxSpanX = options.columns() - widget.colStart + 1;
      const maxSpanY = options.rows() - widget.rowStart + 1;
      options.updateWidget(widget.id, {
        colSpan: clamp(initialColSpan + colDelta, minSpanX, maxSpanX),
        rowSpan: clamp(initialRowSpan + rowDelta, minSpanY, maxSpanY)
      });
      options.updatePanelPlacement();
    };
    const onUp = () => {
      options.setInteraction(null);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      window.removeEventListener("blur", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    window.addEventListener("blur", onUp);
  };

  return {
    onLibraryDragStart,
    handleGridDrop,
    handleGridDragOver,
    startWidgetDrag,
    startWidgetResize
  };
}
