import { render, screen } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";
import { HelpModule } from "./HelpModule";

describe("HelpModule", () => {
  it("renders registry documentation from all module contributors", () => {
    render(() => <HelpModule />);

    expect(screen.getByRole("heading", { name: "Help & Documentation" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Application Overview" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Dashboard Module" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Traffic Analysis Module" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Application Settings Module" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "User Settings Module" })).toBeInTheDocument();
    expect(screen.getByText("Navigate Modules")).toBeInTheDocument();
    expect(screen.getByText("Work Across Breakpoints")).toBeInTheDocument();
  });
});
