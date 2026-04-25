import { fireEvent, render, within } from "@solidjs/testing-library";
import { describe, expect, it, vi } from "vitest";
import { LeftNavRail } from "./LeftNavRail";

describe("LeftNavRail", () => {
  it("renders top-level nav actions", () => {
    const onSelectNavTool = vi.fn();
    const view = render(() => (
      <LeftNavRail activeNavTool="dashboards" onSelectNavTool={onSelectNavTool} />
    ));
    const local = within(view.container);

    expect(local.getByRole("button", { name: "Dashboards" })).toBeInTheDocument();
    expect(local.getByRole("button", { name: "Traffic Analysis" })).toBeInTheDocument();
    expect(local.getByRole("button", { name: "Help" })).toBeInTheDocument();
    expect(local.getByRole("button", { name: "Settings" })).toBeInTheDocument();
  });

  it("blocks non-dashboard tools when lock gate is enabled", async () => {
    const onSelectNavTool = vi.fn();
    const view = render(() => (
      <LeftNavRail
        activeNavTool="dashboards"
        toolSwitchLocked
        onSelectNavTool={onSelectNavTool}
      />
    ));
    const local = within(view.container);

    const rail = view.container.querySelector(".left-nav");
    const dashboards = local.getByRole("button", { name: "Dashboards" });
    const traffic = local.getByRole("button", { name: "Traffic Analysis" });
    const help = local.getByRole("button", { name: "Help" });
    const settings = local.getByRole("button", { name: "Settings" });

    expect(rail?.classList.contains("nav-switch-disabled")).toBe(true);
    expect(traffic).toHaveAttribute("aria-disabled", "true");
    expect(help).toHaveAttribute("aria-disabled", "true");
    expect(settings).toHaveAttribute("aria-disabled", "true");

    await fireEvent.click(traffic);
    await fireEvent.click(help);
    await fireEvent.click(settings);
    expect(onSelectNavTool).not.toHaveBeenCalled();

    await fireEvent.click(dashboards);
    expect(onSelectNavTool).toHaveBeenCalledTimes(1);
    expect(onSelectNavTool).toHaveBeenLastCalledWith("dashboards");
  });

  it("allows all actions when lock gate is disabled", async () => {
    const onSelectNavTool = vi.fn();
    const view = render(() => (
      <LeftNavRail activeNavTool="dashboards" onSelectNavTool={onSelectNavTool} />
    ));
    const local = within(view.container);

    const rail = view.container.querySelector(".left-nav");
    expect(rail?.classList.contains("nav-switch-disabled")).toBe(false);

    await fireEvent.click(local.getByRole("button", { name: "Traffic Analysis" }));
    await fireEvent.click(local.getByRole("button", { name: "Help" }));
    await fireEvent.click(local.getByRole("button", { name: "Settings" }));

    expect(onSelectNavTool).toHaveBeenCalledTimes(3);
    expect(onSelectNavTool).toHaveBeenNthCalledWith(1, "trafficAnalysis");
    expect(onSelectNavTool).toHaveBeenNthCalledWith(2, "help");
    expect(onSelectNavTool).toHaveBeenNthCalledWith(3, "settings");
  });
});

