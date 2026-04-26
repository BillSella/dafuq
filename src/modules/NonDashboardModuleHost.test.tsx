import { render, screen } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";
import { NonDashboardModuleHost } from "./NonDashboardModuleHost";

describe("NonDashboardModuleHost", () => {
  it("renders traffic module placeholder copy from registry", () => {
    render(() => <NonDashboardModuleHost moduleId="trafficAnalysis" />);
    expect(screen.getByText("Traffic Analysis view placeholder.")).toBeInTheDocument();
  });

  it("renders help module documentation", () => {
    render(() => <NonDashboardModuleHost moduleId="help" />);
    expect(screen.getByRole("heading", { name: "Help & Documentation" })).toBeInTheDocument();
    expect(screen.getByText("Dashboard Module")).toBeInTheDocument();
  });

  it("renders access denied placeholder when policy blocks module", () => {
    render(() => <NonDashboardModuleHost moduleId="settings" canAccessModule={() => false} />);
    expect(screen.getByText(/You do not currently have access to this module\./)).toBeInTheDocument();
  });
});
