import { cleanup, fireEvent, render, screen } from "@solidjs/testing-library";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FormatDecimalsFields } from "./FormatDecimalsFields";

afterEach(() => {
  cleanup();
});

describe("FormatDecimalsFields", () => {
  it("renders format and decimals selectors with selected values", () => {
    render(() => (
      <FormatDecimalsFields
        format="compact"
        decimals={2}
        formatAriaLabel="Value format"
        decimalsAriaLabel="Value decimals"
        onFormatChange={vi.fn()}
        onDecimalsChange={vi.fn()}
      />
    ));

    expect(screen.getByRole("radiogroup", { name: "Value format" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Compact" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "2" })).toHaveAttribute("aria-checked", "true");
  });

  it("emits format and decimals changes", async () => {
    const onFormatChange = vi.fn();
    const onDecimalsChange = vi.fn();
    render(() => (
      <FormatDecimalsFields
        format="full"
        decimals={0}
        formatAriaLabel="Widget format"
        decimalsAriaLabel="Widget decimals"
        onFormatChange={onFormatChange}
        onDecimalsChange={onDecimalsChange}
      />
    ));

    await fireEvent.click(screen.getByRole("radio", { name: "Compact" }));
    await fireEvent.click(screen.getByRole("radio", { name: "3" }));

    expect(onFormatChange).toHaveBeenCalledWith("compact");
    expect(onDecimalsChange).toHaveBeenCalledWith(3);
  });
});

