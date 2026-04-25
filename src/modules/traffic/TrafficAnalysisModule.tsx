import { DashboardPlaceholderPane } from "../../components/layout/DashboardPlaceholderPane";
import { getModulePlaceholderMessage } from "../moduleRegistry";

/** Placeholder workspace until traffic analytics ships */
export function TrafficAnalysisModule() {
  return <DashboardPlaceholderPane message={getModulePlaceholderMessage("trafficAnalysis")} />;
}
