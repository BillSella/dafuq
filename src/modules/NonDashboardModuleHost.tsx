import { Match, Switch } from "solid-js";
import { HelpModule } from "./help/HelpModule";
import type { AppModuleId } from "./moduleTypes";
import { AppSettingsModule } from "./settings/AppSettingsModule";
import { TrafficAnalysisModule } from "./traffic/TrafficAnalysisModule";
import { UserSettingsModule } from "./user/UserSettingsModule";

type NonDashboardModuleHostProps = {
  moduleId: AppModuleId;
};

/**
 * Dispatches main-region UI for modules other than dashboards.
 * Each branch maps to a module file under `src/modules/<name>/`.
 */
export function NonDashboardModuleHost(props: NonDashboardModuleHostProps) {
  return (
    <Switch>
      <Match when={props.moduleId === "trafficAnalysis"}>
        <TrafficAnalysisModule />
      </Match>
      <Match when={props.moduleId === "help"}>
        <HelpModule />
      </Match>
      <Match when={props.moduleId === "userSettings"}>
        <UserSettingsModule />
      </Match>
      <Match when={props.moduleId === "settings"}>
        <AppSettingsModule />
      </Match>
    </Switch>
  );
}
