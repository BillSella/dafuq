import { ApiSettingsSection } from "./ApiSettingsSection";
import { ApiConnectionFields } from "./ApiConnectionFields";
import { LabelFieldRow } from "../ui/LabelFieldRow";
import { PillSelector } from "../ui/PillSelector";
import type { JSX } from "solid-js";
import type { LabelConfig } from "../../widgets/labelWidget";

type LabelSettingsFormProps = {
  config: LabelConfig;
  dashboardUpdateGroups: string[];
  onPatch: (patch: Partial<LabelConfig>) => void;
  baseSettings: JSX.Element;
};

export function LabelSettingsForm(props: LabelSettingsFormProps) {
  return (
    <>
      {props.baseSettings}
      <LabelFieldRow label="Source">
        <PillSelector
          ariaLabel="Label source"
          selected={(props.config.sourceMode ?? "static") as "static" | "api"}
          options={[
            { value: "static", label: "Static" },
            { value: "api", label: "API" }
          ]}
          onSelect={(option) => {
            props.onPatch({ sourceMode: option });
          }}
        />
      </LabelFieldRow>
      <div class="widget-settings-bottom-spacer" />
      <ApiSettingsSection>
        <ApiConnectionFields
          endpointUrl={props.config.apiEndpoint ?? ""}
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
