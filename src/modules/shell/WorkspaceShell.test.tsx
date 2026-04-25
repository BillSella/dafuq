import { render, screen } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";
import { WorkspaceShell } from "./WorkspaceShell";

describe("WorkspaceShell", () => {
  it("renders logo, topbar slots, main slot, and left rail", () => {
    render(() => (
      <WorkspaceShell
        activeNavTool="help"
        onSelectNavTool={() => {}}
        toolSwitchLocked={false}
        topbarCenter={() => <div>Center Slot</div>}
        topbarTools={() => <div>Tools Slot</div>}
        main={() => <div>Main Slot</div>}
      />
    ));
    expect(screen.getByTitle("dafuq")).toBeInTheDocument();
    expect(screen.getByText("Center Slot")).toBeInTheDocument();
    expect(screen.getByText("Tools Slot")).toBeInTheDocument();
    expect(screen.getByText("Main Slot")).toBeInTheDocument();
    expect(screen.getByText("Help")).toBeInTheDocument();
  });
});
