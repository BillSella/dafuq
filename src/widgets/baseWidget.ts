/**
 * Plain serializable widget state used by Solid signals and persistence layers.
 * Keep this shape JSON-friendly so state can be safely cloned and restored.
 */
export type WidgetState<TType extends string, TConfig> = {
  id: string;
  type: TType;
  colStart: number;
  rowStart: number;
  colSpan: number;
  rowSpan: number;
  config: TConfig;
};

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Base immutable widget model.
 *
 * Concrete widgets inherit shared placement/resize behavior and add
 * widget-specific config + rendering helpers in subclasses.
 */
export abstract class BaseWidget<TType extends string, TConfig> {
  readonly id: string;
  readonly type: TType;
  readonly colStart: number;
  readonly rowStart: number;
  readonly colSpan: number;
  readonly rowSpan: number;
  readonly config: TConfig;

  protected constructor(state: WidgetState<TType, TConfig>) {
    this.id = state.id;
    this.type = state.type;
    this.colStart = state.colStart;
    this.rowStart = state.rowStart;
    this.colSpan = state.colSpan;
    this.rowSpan = state.rowSpan;
    this.config = state.config;
  }

  /** Factory hook used by fluent methods to preserve subclass type. */
  protected abstract instantiate(state: WidgetState<TType, TConfig>): this;

  toState(): WidgetState<TType, TConfig> {
    return {
      id: this.id,
      type: this.type,
      colStart: this.colStart,
      rowStart: this.rowStart,
      colSpan: this.colSpan,
      rowSpan: this.rowSpan,
      config: this.config
    };
  }

  withPatch(patch: Partial<WidgetState<TType, TConfig>>): this {
    return this.instantiate({
      ...this.toState(),
      ...patch
    });
  }

  withConfigPatch(patch: Partial<TConfig>): this {
    return this.instantiate({
      ...this.toState(),
      config: { ...this.config, ...patch } as TConfig
    });
  }

  /** Clamp widget bounds so it stays fully inside the grid. */
  clampToGrid(columns: number, rows: number, minSpan: number): this {
    const colSpan = clamp(this.colSpan, minSpan, columns);
    const rowSpan = clamp(this.rowSpan, minSpan, rows);
    const colStart = clamp(this.colStart, 1, columns - colSpan + 1);
    const rowStart = clamp(this.rowStart, 1, rows - rowSpan + 1);
    return this.withPatch({ colSpan, rowSpan, colStart, rowStart });
  }

  /**
   * Remap position/size when grid unit changes:
   * 1) project current state into pixel space using previous step
   * 2) convert back to next-step grid units
   * 3) clamp to target grid bounds
   */
  remapByStep(prevStep: number, nextStep: number, columns: number, rows: number, minSpan: number): this {
    const pixelLeft = (this.colStart - 1) * prevStep;
    const pixelTop = (this.rowStart - 1) * prevStep;
    const pixelWidth = this.colSpan * prevStep;
    const pixelHeight = this.rowSpan * prevStep;

    const colSpan = clamp(Math.max(minSpan, Math.round(pixelWidth / nextStep)), minSpan, columns);
    const rowSpan = clamp(Math.max(minSpan, Math.round(pixelHeight / nextStep)), minSpan, rows);
    const colStart = clamp(Math.round(pixelLeft / nextStep) + 1, 1, columns - colSpan + 1);
    const rowStart = clamp(Math.round(pixelTop / nextStep) + 1, 1, rows - rowSpan + 1);

    return this.withPatch({ colStart, rowStart, colSpan, rowSpan });
  }
}
