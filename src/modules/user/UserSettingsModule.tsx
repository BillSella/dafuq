import { DashboardPlaceholderPane } from "../../components/layout/DashboardPlaceholderPane";
import { getModulePlaceholderMessage } from "../moduleRegistry";

export function UserSettingsModule() {
  return <DashboardPlaceholderPane message={getModulePlaceholderMessage("userSettings")} />;
}
