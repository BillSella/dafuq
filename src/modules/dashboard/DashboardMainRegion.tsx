import { Show, type Accessor, type ParentComponent } from "solid-js";
import { NonDashboardModuleHost } from "../NonDashboardModuleHost";
import type { AppModuleId } from "../moduleTypes";
import { DashboardModule } from "./DashboardModule";

type DashboardMainRegionProps = {
  activeNavTool: Accessor<AppModuleId>;
  canAccessModule?: (moduleId: AppModuleId) => boolean;
};

/**
 * Main host: dashboards workspace vs module-specific placeholder panes.
 */
export const DashboardMainRegion: ParentComponent<DashboardMainRegionProps> = (props) => {
  return (
    <Show
      when={props.activeNavTool() === "dashboards"}
      fallback={
        <NonDashboardModuleHost
          moduleId={props.activeNavTool()}
          canAccessModule={props.canAccessModule}
        />
      }
    >
      <DashboardModule>{props.children}</DashboardModule>
    </Show>
  );
};
