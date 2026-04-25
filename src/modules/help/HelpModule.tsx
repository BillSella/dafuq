import { DashboardPlaceholderPane } from "../../components/layout/DashboardPlaceholderPane";
import { getModulePlaceholderMessage } from "../moduleRegistry";

export function HelpModule() {
  return <DashboardPlaceholderPane message={getModulePlaceholderMessage("help")} />;
}
