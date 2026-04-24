import type { MapConfig } from "../../widgets/mapWidget";
import type { JSX } from "solid-js";
import { ApiSettingsSection } from "./ApiSettingsSection";
import { ApiConnectionFields } from "./ApiConnectionFields";
import { LabelFieldRow } from "../ui/LabelFieldRow";
import { PillSelector } from "../ui/PillSelector";

type MapSettingsFormProps = {
  config: MapConfig;
  dashboardUpdateGroups: string[];
  onPatch: (patch: Partial<MapConfig>) => void;
  baseSettings: JSX.Element;
};

export function MapSettingsForm(props: MapSettingsFormProps) {
  return (
    <>
      {props.baseSettings}
      <LabelFieldRow label="Region">
        <PillSelector
          ariaLabel="Map basemap"
          selected={props.config.mapRegion ?? "world"}
          options={[
            { value: "world", label: "World" },
            { value: "usa", label: "USA" }
          ]}
          onSelect={(option) => props.onPatch({ mapRegion: option })}
        />
      </LabelFieldRow>
      <LabelFieldRow label="Line Curve" class="section-gap-top">
        <input
          type="range"
          min="0.04"
          max="0.35"
          step="0.01"
          value={String(props.config.lineBend ?? 0.14)}
          onInput={(event) => props.onPatch({ lineBend: Number(event.currentTarget.value) })}
        />
      </LabelFieldRow>
      <div class="widget-settings-bottom-spacer" />
      <ApiSettingsSection>
        <ApiConnectionFields
          endpointUrl={props.config.apiEndpoint ?? ""}
          endpointPlaceholder="https://api.example.com/..."
          updateGroup={props.config.updateGroup ?? ""}
          updateGroupOptions={props.dashboardUpdateGroups}
          updateGroupListId="widget-update-group-options"
          onEndpointUrlChange={(value) => props.onPatch({ apiEndpoint: value })}
          onUpdateGroupChange={(value) => props.onPatch({ updateGroup: value })}
        />
      </ApiSettingsSection>
    </>
  );
}
