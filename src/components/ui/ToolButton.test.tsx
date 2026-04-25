import { fireEvent, render, screen } from "@solidjs/testing-library";
import { describe, expect, it, vi } from "vitest";
import { ToolButton } from "./ToolButton";

describe("ToolButton", () => {
  it("forwards accessibility and click behavior", async () => {
    const onClick = vi.fn();
    render(() => (
      <ToolButton
        class="test-tool"
        type="button"
        title="Open menu"
        aria-label="Open menu"
        aria-expanded={true}
        onClick={onClick}
      >
        Trigger
      </ToolButton>
    ));

    const button = screen.getByRole("button", { name: "Open menu" });
    expect(button).toHaveAttribute("title", "Open menu");
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(button.classList.contains("test-tool")).toBe(true);

    await fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("respects disabled state", async () => {
    const onClick = vi.fn();
    render(() => (
      <ToolButton aria-label="Disabled" disabled onClick={onClick}>
        Disabled
      </ToolButton>
    ));

    const button = screen.getByRole("button", { name: "Disabled" });
    expect(button).toBeDisabled();
    await fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});

