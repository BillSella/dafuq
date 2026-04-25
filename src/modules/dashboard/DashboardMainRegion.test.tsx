import { render, screen } from "@solidjs/testing-library";
import { createSignal } from "solid-js";
import { describe, expect, it } from "vitest";
import type { AppModuleId } from "../moduleTypes";
import { DashboardMainRegion } from "./DashboardMainRegion";

describe("DashboardMainRegion", () => {
  it("shows module placeholder when nav is not dashboards", () => {
    const [activeNavTool, setActiveNavTool] = createSignal<AppModuleId>("help");
    render(() => (
      <DashboardMainRegion activeNavTool={activeNavTool}>
        <div>Editor Surface</div>
      </DashboardMainRegion>
    ));
    expect(
      screen.getByText(/Help view placeholder\. We can add status-dot legend and usage docs here\./)
    ).toBeInTheDocument();
    expect(screen.queryByText("Editor Surface")).not.toBeInTheDocument();
    setActiveNavTool("dashboards");
    expect(screen.getByText("Editor Surface")).toBeInTheDocument();
  });
});
