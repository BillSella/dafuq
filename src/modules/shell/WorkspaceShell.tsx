import type { JSX } from "solid-js";
import { DafuqLogo } from "../../components/DafuqLogo";
import { LeftNavRail } from "../../components/layout/LeftNavRail";
import type { AppModuleId } from "../moduleTypes";

export type WorkspaceShellProps = {
  activeNavTool: AppModuleId;
  onSelectNavTool: (id: AppModuleId) => void;
  toolSwitchLocked: boolean;
  /** Call each render so inner topbar reads stay reactive */
  topbarCenter: () => JSX.Element;
  topbarTools: () => JSX.Element;
  main: () => JSX.Element;
  overlays?: () => JSX.Element;
};

/**
 * Application chrome: logo, topbar row, left nav, main host, optional overlays.
 * Module-specific UI is supplied via slot functions from the active workspace.
 */
export function WorkspaceShell(props: WorkspaceShellProps) {
  return (
    <div class="app-shell">
      <header class="app-topbar">
        <div class="app-topbar-logo" title="dafuq">
          <DafuqLogo />
        </div>
        {props.topbarCenter()}
        {props.topbarTools()}
      </header>
      <div class="app-main">
        <LeftNavRail
          activeNavTool={props.activeNavTool}
          toolSwitchLocked={props.toolSwitchLocked}
          onSelectNavTool={props.onSelectNavTool}
        />
        <main class="dashboard-host">{props.main()}</main>
      </div>
      {props.overlays?.()}
    </div>
  );
}
