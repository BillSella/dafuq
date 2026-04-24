import { NavBottomGroup } from "../ui/NavBottomGroup";
import { NavToolButton } from "../ui/NavToolButton";

type LeftNavTool = "dashboards" | "trafficAnalysis" | "help" | "settings" | "userLogin" | "userSettings";

type LeftNavRailProps = {
  activeNavTool: LeftNavTool;
  onSelectNavTool: (tool: LeftNavTool) => void;
};

export function LeftNavRail(props: LeftNavRailProps) {
  return (
    <aside class="left-nav">
      <NavToolButton
        active={props.activeNavTool === "dashboards"}
        title="Dashboards"
        label="Dashboards"
        showNativeTooltip={false}
        onClick={() => props.onSelectNavTool("dashboards")}
        icon={
          <svg viewBox="0 0 24 24">
            <rect x="3.5" y="3.5" width="17" height="17" rx="2.5" />
            <rect x="7" y="7" width="3.4" height="3.4" rx="0.5" />
            <rect x="13.6" y="7" width="3.4" height="3.4" rx="0.5" />
            <rect x="7" y="13.6" width="3.4" height="3.4" rx="0.5" />
            <rect x="13.6" y="13.6" width="3.4" height="3.4" rx="0.5" />
          </svg>
        }
      />
      <NavToolButton
        active={props.activeNavTool === "trafficAnalysis"}
        title="Traffic Analysis"
        label="Traffic Analysis"
        showNativeTooltip={false}
        onClick={() => props.onSelectNavTool("trafficAnalysis")}
        icon={
          <svg viewBox="0 0 24 24">
            <rect x="3.5" y="3.5" width="17" height="17" rx="2.5" />
            <path d="M7 15.5l3-3 2.2 2.2L17 10" />
            <path d="M17 10h-2.6" />
            <path d="M17 10v2.6" />
          </svg>
        }
      />
      <NavBottomGroup>
        <>
          <NavToolButton
            active={props.activeNavTool === "help"}
            title="Help"
            label="Help"
            showNativeTooltip={false}
            onClick={() => props.onSelectNavTool("help")}
            icon={<>?</>}
          />
          <NavToolButton
            active={props.activeNavTool === "settings"}
            title="Settings"
            label="Settings"
            showNativeTooltip={false}
            onClick={() => props.onSelectNavTool("settings")}
            icon={<>⚙</>}
          />
        </>
      </NavBottomGroup>
    </aside>
  );
}
