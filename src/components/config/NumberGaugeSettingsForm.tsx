import type { GaugeConfig } from "../../widgets/gaugeWidget";
import type { JSX } from "solid-js";
import { ApiSettingsSection } from "./ApiSettingsSection";
import { ApiConnectionFields } from "./ApiConnectionFields";
import { FormatDecimalsFields } from "./FormatDecimalsFields";

type NumberGaugeSettingsFormProps = {
  config: GaugeConfig;
  dashboardUpdateGroups: string[];
  onPatch: (patch: Partial<GaugeConfig>) => void;
  baseSettings: JSX.Element;
};

export function NumberGaugeSettingsForm(props: NumberGaugeSettingsFormProps) {
  return (
    <>
      {props.baseSettings}
      <FormatDecimalsFields
        format={props.config.format ?? "full"}
        decimals={props.config.decimalPlaces ?? 1}
        formatAriaLabel="Number format"
        decimalsAriaLabel="Decimal places"
        onFormatChange={(value) => props.onPatch({ format: value })}
        onDecimalsChange={(value) => props.onPatch({ decimalPlaces: value })}
      />

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
