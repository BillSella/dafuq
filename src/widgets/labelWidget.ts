import { BaseWidget, type WidgetState } from "./baseWidget";

export type LabelSourceMode = "static" | "api";
export type LabelAlign = "left" | "center" | "right";

export type LabelConfig = {
  sourceMode: LabelSourceMode;
  align: LabelAlign;
  staticText: string;
  apiEndpoint: string;
  field: string;
  fallbackText: string;
  updateGroup: string;
};

export class LabelWidget extends BaseWidget<"label", LabelConfig> {
  static create(id: string, colStart: number, rowStart: number): LabelWidget {
    return new LabelWidget({
      id,
      type: "label",
      colStart,
      rowStart,
      colSpan: 20,
      rowSpan: 8,
      config: {
        sourceMode: "static",
        align: "center",
        staticText: "Label Text",
        apiEndpoint: "https://api.foo.com/labels/status",
        field: "label",
        fallbackText: "No Data",
        updateGroup: ""
      }
    });
  }

  constructor(state: WidgetState<"label", LabelConfig>) {
    super(state);
  }

  protected instantiate(state: WidgetState<"label", LabelConfig>): this {
    return new LabelWidget(state) as this;
  }

  getDisplayValue(): string {
    if (this.config.sourceMode === "static") {
      return this.config.staticText;
    }
    return this.config.fallbackText;
  }
}
