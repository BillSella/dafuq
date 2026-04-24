import type { DonutConfig } from "../../widgets/donutWidget";
import type { JSX } from "solid-js";
import { ApiSettingsSection } from "./ApiSettingsSection";
import { ApiConnectionFields } from "./ApiConnectionFields";
import { FormatDecimalsFields } from "./FormatDecimalsFields";
import { LabelFieldRow } from "../ui/LabelFieldRow";

type DonutSettingsFormProps = {
  config: DonutConfig;
  dashboardUpdateGroups: string[];
  onPatch: (patch: Partial<DonutConfig>) => void;
  baseSettings: JSX.Element;
};

export function DonutSettingsForm(props: DonutSettingsFormProps) {
  return (
    <>
      {props.baseSettings}
      <FormatDecimalsFields
        format={props.config.format ?? "compact"}
        decimals={props.config.decimals ?? 1}
        formatAriaLabel="Donut format"
        decimalsAriaLabel="Donut decimals"
        onFormatChange={(value) => props.onPatch({ format: value })}
        onDecimalsChange={(value) => props.onPatch({ decimals: value })}
      />
      <LabelFieldRow label="Width" class="section-gap-top">
        <input
          type="range"
          min="6"
          max="25"
          step="1"
          value={String(props.config.ringWidth ?? 13)}
          onInput={(event) => {
            props.onPatch({ ringWidth: Number(event.currentTarget.value) });
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
