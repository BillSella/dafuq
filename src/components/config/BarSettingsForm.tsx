import type { BarConfig } from "../../widgets/barWidget";
import type { JSX } from "solid-js";
import { ApiSettingsSection } from "./ApiSettingsSection";
import { ApiConnectionFields } from "./ApiConnectionFields";
import { FormatDecimalsFields } from "./FormatDecimalsFields";
import { LabelFieldRow } from "../ui/LabelFieldRow";
import { PillSelector } from "../ui/PillSelector";

type BarSettingsFormProps = {
  config: BarConfig;
  dashboardUpdateGroups: string[];
  onPatch: (patch: Partial<BarConfig>) => void;
  baseSettings: JSX.Element;
};

export function BarSettingsForm(props: BarSettingsFormProps) {
  return (
    <>
      {props.baseSettings}
      <fieldset class="field fieldset">
        <span>Chart Type</span>
        <PillSelector
          ariaLabel="Bar chart type"
          selected={props.config.orientation ?? "horizontal"}
          options={[
            { value: "horizontal", label: "Bar" },
            { value: "vertical", label: "Column" }
          ]}
          onSelect={(option) => props.onPatch({ orientation: option })}
        />
      </fieldset>
      <FormatDecimalsFields
        format={props.config.format ?? "compact"}
        decimals={props.config.decimals ?? 1}
        formatAriaLabel="Bar format"
        decimalsAriaLabel="Bar decimals"
        formatClass="section-gap-top"
        onFormatChange={(value) => props.onPatch({ format: value })}
        onDecimalsChange={(value) => props.onPatch({ decimals: value })}
      />
      <LabelFieldRow label="Minimum" class="section-gap-top">
        <input
          type="number"
          value={props.config.min === 0 ? "" : String(props.config.min ?? "")}
          placeholder="Dynamic"
          onInput={(event) => {
            const raw = event.currentTarget.value.trim();
            if (raw === "") return;
            props.onPatch({ min: Number(raw) || 0 });
          }}
        />
      </LabelFieldRow>
      <LabelFieldRow label="Maximum">
        <input
          type="number"
          value={props.config.max === 100 ? "" : String(props.config.max ?? "")}
          placeholder="Dynamic"
          onInput={(event) => {
            const raw = event.currentTarget.value.trim();
            if (raw === "") return;
            props.onPatch({ max: Number(raw) || 100 });
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
