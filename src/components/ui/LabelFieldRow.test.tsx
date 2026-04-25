import { render, screen } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";
import { LabelFieldRow } from "./LabelFieldRow";

describe("LabelFieldRow", () => {
  it("renders label and children inside field container", () => {
    const view = render(() => (
      <LabelFieldRow label="Username" class="custom-field">
        <input type="text" aria-label="Username Input" />
      </LabelFieldRow>
    ));

    expect(screen.getByText("Username")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Username Input" })).toBeInTheDocument();
    const label = view.container.querySelector("label.field.custom-field");
    expect(label).toBeInTheDocument();
  });
});

