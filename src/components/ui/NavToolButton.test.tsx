import { fireEvent, render, screen } from "@solidjs/testing-library";
import { describe, expect, it, vi } from "vitest";
import { NavToolButton } from "./NavToolButton";

describe("NavToolButton", () => {
  it("renders label and aria metadata", () => {
    const onClick = vi.fn();
    render(() => (
      <NavToolButton
        active={false}
        title="Help"
        label="Help"
        icon={<span>?</span>}
        onClick={onClick}
      />
    ));

    const button = screen.getByRole("button", { name: "Help" });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("title", "Help");
    expect(button).toHaveAttribute("aria-disabled", "false");
  });

  it("calls onClick when not blocked", async () => {
    const onClick = vi.fn();
    render(() => (
      <NavToolButton
        active={false}
        title="Dashboards"
        label="Dashboards"
        icon={<span>D</span>}
        onClick={onClick}
      />
    ));

    await fireEvent.click(screen.getByRole("button", { name: "Dashboards" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does not call onClick when blocked", async () => {
    const onClick = vi.fn();
    render(() => (
      <NavToolButton
        active={false}
        title="Settings"
        label="Settings"
        icon={<span>S</span>}
        blocked
        onClick={onClick}
      />
    ));

    const button = screen.getByRole("button", { name: "Settings" });
    await fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button.classList.contains("blocked")).toBe(true);
  });
});

