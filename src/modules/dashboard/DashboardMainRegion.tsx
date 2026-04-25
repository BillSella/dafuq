import { Show, type Accessor, type ParentComponent } from "solid-js";
import { NonDashboardModuleHost } from "../NonDashboardModuleHost";
import type { AppModuleId } from "../moduleTypes";
import { DashboardModule } from "./DashboardModule";

type DashboardMainRegionProps = {
  activeNavTool: Accessor<AppModuleId>;
};

/**
 * Main host: dashboards workspace vs module-specific placeholder panes.
 */
export const DashboardMainRegion: ParentComponent<DashboardMainRegionProps> = (props) => {
  return (
    <Show
      when={props.activeNavTool() === "dashboards"}
      fallback={<NonDashboardModuleHost moduleId={props.activeNavTool()} />}
    >
      <DashboardModule>{props.children}</DashboardModule>
    </Show>
  );
};
