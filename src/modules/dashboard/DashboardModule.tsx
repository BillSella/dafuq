import type { ParentComponent } from "solid-js";

/**
 * Root mount for the dashboards module.
 * The full editor subtree still lives in App until it is migrated behind a slimmer host contract.
 */
export const DashboardModule: ParentComponent = (props) => <>{props.children}</>;
