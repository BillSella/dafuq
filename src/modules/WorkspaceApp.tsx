import { createSignal } from "solid-js";
import { useSession } from "../session/SessionContext";
import DashboardApp from "./dashboard/DashboardApp";
import { hasModuleAccess } from "./moduleAccessPolicy";
import type { AppModuleId } from "./moduleTypes";

/**
 * Application-layer workspace root. Owns top-level module selection and routes
 * access decisions through shared module policy before delegating to modules.
 */
export default function WorkspaceApp() {
  const session = useSession();
  const [activeNavTool, setActiveNavTool] = createSignal<AppModuleId>("dashboards");

  const onSelectNavTool = (moduleId: AppModuleId) => {
    if (!hasModuleAccess(moduleId, { isAuthenticated: session.isAuthenticated() })) return;
    setActiveNavTool(moduleId);
  };

  return (
    <DashboardApp activeNavTool={activeNavTool()} onSelectNavTool={onSelectNavTool} />
  );
}
