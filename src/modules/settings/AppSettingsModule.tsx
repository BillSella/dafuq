import { DashboardPlaceholderPane } from "../../components/layout/DashboardPlaceholderPane";
import { getModulePlaceholderMessage } from "../moduleRegistry";

export function AppSettingsModule() {
  return <DashboardPlaceholderPane message={getModulePlaceholderMessage("settings")} />;
}
