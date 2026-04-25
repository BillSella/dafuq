import { fireEvent, render, screen } from "@solidjs/testing-library";
import { describe, expect, it, vi } from "vitest";
import { PillSelector } from "./PillSelector";

describe("PillSelector", () => {
  it("renders as radiogroup and marks selected option", () => {
    render(() => (
      <PillSelector
        ariaLabel="Font size"
        selected="medium"
        options={[
          { value: "small", label: "Small" },
          { value: "medium", label: "Medium" },
          { value: "large", label: "Large" }
        ]}
        onSelect={vi.fn()}
      />
    ));

    expect(screen.getByRole("radiogroup", { name: "Font size" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Medium" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Small" })).toHaveAttribute("aria-checked", "false");
  });

  it("emits selected value through callback", async () => {
    const onSelect = vi.fn();
    render(() => (
      <PillSelector
        ariaLabel="Alignment"
        selected="left"
        options={[
          { value: "left", label: "Left" },
          { value: "center", label: "Center" }
        ]}
        onSelect={onSelect}
      />
    ));

    await fireEvent.click(screen.getByRole("radio", { name: "Center" }));
    expect(onSelect).toHaveBeenCalledWith("center");
  });
});

