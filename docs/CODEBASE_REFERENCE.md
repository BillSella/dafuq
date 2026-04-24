# Dashboard Widgets Codebase Reference

This document maps the current code, function-by-function and file-by-file, so future debugging can be done quickly and consistently.

## File Map

- `src/main.tsx`
  - App bootstrap: mounts Solid app and imports global CSS.
- `src/App.tsx`
  - Main dashboard editor UI, interaction logic, drag/drop, resize, config panel behavior.
- `src/widgets/baseWidget.ts`
  - Reusable base widget behavior class used by concrete widgets.
- `src/widgets/gaugeWidget.ts`
  - Gauge widget model/config defaults and gauge-specific value formatting behavior.
- `src/index.css`
  - Global layout, toolbar, grid, widget visuals, config panel visuals, control styling.

Legacy duplicate JS files were removed. The source of truth is now:
- `src/main.tsx`
- `src/App.tsx`
- `src/widgets/baseWidget.ts`
- `src/widgets/gaugeWidget.ts`

---

## `src/main.tsx`

### `render(() => <App />, ...)`
- Entry point.
- Loads `App` and global CSS.

---

## `src/widgets/baseWidget.ts`

## Types

### `WidgetState<TType, TConfig>`
- Plain serializable widget state shape:
  - `id`, `type`, `colStart`, `rowStart`, `colSpan`, `rowSpan`, `config`.

### `clamp(value, min, max)`
- Utility clamp used across grid/size math.

## Class: `BaseWidget<TType, TConfig>`

Purpose: define shared behavior for widget classes.

### Constructor
- Accepts full `WidgetState`.
- Stores read-only state fields.

### `instantiate(state)`
- Abstract factory method implemented by child class.
- Ensures fluent methods return correct subclass type.

### `toState()`
- Converts class instance to plain `WidgetState`.

### `withPatch(patch)`
- Returns new widget instance with top-level state patch merged.

### `withConfigPatch(patch)`
- Returns new widget instance with `config` patch merged.

### `clampToGrid(columns, rows, minSpan)`
- Enforces spans and starts stay within grid bounds.

### `remapByStep(prevStep, nextStep, columns, rows, minSpan)`
- Converts current col/row/span to pixel space (using `prevStep`), then remaps to target step (`nextStep`) and clamps.
- Used when grid unit size changes.

---

## `src/widgets/gaugeWidget.ts`

## Types

### `NumberFormat`
- `"full" | "compact"`.

### `GaugeFontSize`
- `"small" | "medium" | "large"`.

### `GaugeAlign`
- `"left" | "center" | "right"`.

### `GaugeConfig`
- Gauge-specific settings:
  - `label`
  - `fontSize`
  - `align`
  - `defaultValue` (string; supports numeric or text fallback)
  - `format`
  - `decimalPlaces` (`0 | 1 | 3`)
  - `apiEndpoint`
  - `field`

## Internal helpers

### `formatWithSuffix(value, decimals)`
- Compact notation (`k/m/b/t`).

### `formatNumber(value, format, decimals)`
- Full format uses `Intl.NumberFormat`; compact uses suffix helper.

## Class: `GaugeWidget extends BaseWidget<"numberGauge", GaugeConfig>`

### `static create(id, colStart, rowStart)`
- Creates default gauge widget:
  - default span `4x4` (currently used as default 128x128 at default unit)
  - default config values set here.

### `instantiate(state)`
- Required override for base fluent methods.

### `getDisplayValue()`
- If `defaultValue` parses as finite number, format via selected number format/decimals.
- Otherwise returns raw text value (e.g. `"No Data"`).

---

## `src/App.tsx`

This is the primary orchestration file.

## Top-level constants/types

### `SlideDirection`
- `"left" | "right" | "top" | "bottom"`.

### `WidgetType`
- Currently only `"numberGauge"`.

### `LIBRARY_WIDGET_KEY`
- Drag-and-drop MIME-like key used in DataTransfer.

### `WIDGET_LIBRARY`
- Toolbar icon metadata for draggable widgets.

### `CELL_SIZE_OPTIONS`
- Allowed grid units: `[16, 32, 64]`.

### `BASE_GRID_UNIT`
- Base for stable grid scaling logic (`64`).

### `DashboardWidget`
- Alias: plain `WidgetState<"numberGauge", GaugeConfig>`.

## Helper functions

### `asGaugeWidget(widget)`
- Wraps plain state as `GaugeWidget` instance for behavior methods.

### `getGaugeDisplayValue(widget)`
- Delegates display formatting to `GaugeWidget.getDisplayValue()`.

### `getSlidePlacement(anchorRect, panelWidth, panelHeight)`
- Generic placement helper that chooses direction by available viewport space and clamps top/left.
- Currently still used by dashboard settings panel; widget panel now manually centers on grid.

## `App()` state

Key signals:
- Grid sizing:
  - `gridUnitSize`, `gridViewportWidth`, `gridViewportHeight`.
- Widget data:
  - `widgets`.
- Interaction:
  - `interaction` (`dragging`/`resizing` + widget id).
- Config panel:
  - `configWidgetId`, panel position + dimensions.
- Dashboard settings panel:
  - open state + placement data.
- Drag/drop:
  - `dragPreview`, `draggingLibraryType`.
- Grid visual mode:
  - `gridHoverVisible`.

Refs:
- `gridRef`, `gridShellRef`
- `dashboardSettingsButtonRef`
- `widgetConfigPanelRef`
- `widgetRefs` map (widget id -> element)

Non-reactive locals:
- `idCounter`
- `previousStep`
- constants for gap/insets.

## Computed values

- `cellSize`: inner square size (`gridUnitSize - gap`)
- `step`: pitch per cell (`gridUnitSize`)
- base grid dimensions (`baseColumns`, `baseRows`) from `BASE_GRID_UNIT`
- actual `columns`, `rows` scaled from base using current step
- `gridWidth`, `gridHeight`, `cellCount`
- `activeWidget` lookup

## Behavior functions

### `fontSizeValue(size)`
- Maps `small/medium/large` to rem values.

### `textAlignValue(align)`
- Returns direct CSS text-align value.

### `updateWidget(id, patch)`
- Applies top-level widget patch (position/span).

### `updateWidgetConfig(id, patch)`
- Applies widget config patch.

### `deleteWidget(id)`
- Removes widget and closes config panel if needed.

### `ensureWidgetsFitGrid(nextColumns, nextRows)`
- Clamps each widget within current grid bounds.

### `updatePanelPlacement()`
- Centers widget config panel over grid area (not near widget anymore).
- Calculates adaptive width/height and clamps to viewport.

### `updateDashboardPanelPlacement()`
- Positions dashboard settings panel around toolbar settings button.

### `addWidgetAt(type, col, row)`
- Creates widget from library at dropped cell.

### `onLibraryDragStart(event, type)`
- Starts library drag and initializes drop preview.

### `detectDraggedLibraryType(event)`
- Resolves widget type from active state or DataTransfer.

### `getCellFromPointer(clientX, clientY)`
- Converts pointer position to snapped grid cell.

### `handleGridDrop(event)`
- Finalize add widget on drop.

### `handleGridDragOver(event)`
- Updates ghost preview during drag.

### `startWidgetDrag(event, widget)`
- Begins pointer drag move interaction for widget.

### `startWidgetResize(event, widget)`
- Begins pointer drag resize interaction for widget.

## `createEffect` blocks

1. Global interaction cleanup listeners (`pointerup`, `blur`, etc).
2. Widget config panel open lifecycle:
   - reposition on resize/scroll
   - close on Escape
   - close on outside click
3. Dashboard settings panel open lifecycle.
4. `ResizeObserver` for grid container.
5. One-time widget normalization on app startup.
6. Fit widgets into current grid.
7. Remap widget spans/positions when grid unit changes.
8. Optional debug event counters exposed to `window.__widgetDebug` when debug mode is enabled.

---

## `src/index.css`

## Theme / palette vars

In `:root`, widget colors are centralized:
- `--widget-surface-start`
- `--widget-surface-end`
- `--widget-border`
- `--widget-border-active`
- `--widget-edit-ring`
- `--widget-text-primary`
- `--widget-shadow`
- `--widget-shadow-edit`

This is the current baseline for palette-driven widget theming.

## Major styling sections

- App layout:
  - `.dashboard-editor`, `.editor-toolbar`, `.editor-grid-area`
- Toolbar:
  - `.library-*`, `.toolbar-config`
- Grid:
  - `.grid-widget`, `.grid-cell`, `.drop-ghost`
- Widget shell:
  - `.number-gauge`, state classes (`.dragging`, `.resizing`, `.editing`)
- Widget controls on hover:
  - `.config-toggle`, `.resize-handle`, `.delete-handle`
- Config panel:
  - `.widget-config-overlay` + slide direction modifiers
- Settings form controls:
  - `.field`, `.pill-group`, `.pill-option`, `.endpoint-field`, separators

---

## Tricky Choices / Risk Points

## 1) Class + plain state interop
- Current pattern stores plain state and wraps with `GaugeWidget` when behavior needed.
- This is safer than storing class instances in signals, but adds conversion overhead and debugging complexity.

## 2) Drag behavior depends on multiple global listeners
- Move/resize state cleanup relies on several global events.
- If one path mutates interaction unexpectedly, classes can visually stick.

## 3) Config panel close logic
- Widget config panel closes on any pointerdown outside panel.
- This can interact with widget click/drag actions if event ordering changes.

## 4) Grid sizing model is intentionally non-trivial
- Base unit scaling (`64`) + step remapping + widget inset + edge padding.
- Improves visual consistency across 16/32/64, but raises complexity for debugging placement math.

---

## Suggested Next Debug Step

Debug counters are already instrumented in `App.tsx` behind `DEBUG_WIDGET_EVENTS`.
- Open browser devtools console to view `[widget-debug] ...` traces.
- Inspect `window.__widgetDebug()` for event counts.

This quickly shows whether failures are event-path, state-path, or render-path.

