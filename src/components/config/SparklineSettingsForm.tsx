import type { SparklineConfig } from "../../widgets/sparklineWidget";
import type { JSX } from "solid-js";
import { ApiSettingsSection } from "./ApiSettingsSection";
import { ApiConnectionFields } from "./ApiConnectionFields";
import { FormatDecimalsFields } from "./FormatDecimalsFields";
import { TogglePillField } from "./TogglePillField";
import { LabelFieldRow } from "../ui/LabelFieldRow";

type SparklineSettingsFormProps = {
  config: SparklineConfig;
  dashboardUpdateGroups: string[];
  onPatch: (patch: Partial<SparklineConfig>) => void;
  baseSettings: JSX.Element;
};

/**
 * Sparkline chart configuration form combining shared and chart-specific fields.
 *
 * State modification contract:
 * - Source of truth: parent-owned `config`.
 * - Mutation path: emits partial sparkline updates via `onPatch`.
 * - Reuses shared formatting/toggle/API field primitives.
 */
export function SparklineSettingsForm(props: SparklineSettingsFormProps) {
  return (
    <>
      {props.baseSettings}
      <FormatDecimalsFields
        format={props.config.format ?? "compact"}
        decimals={props.config.decimals ?? 1}
        formatAriaLabel="Sparkline format"
        decimalsAriaLabel="Sparkline decimals"
        onFormatChange={(value) => props.onPatch({ format: value })}
        onDecimalsChange={(value) => props.onPatch({ decimals: value })}
      />
      <TogglePillField
        label="Fill"
        ariaLabel="Sparkline area fill"
        value={props.config.showFill !== false}
        class="section-gap-top"
        onChange={(value) => props.onPatch({ showFill: value })}
      />
      <LabelFieldRow label="Line Width" class="section-gap-top">
        <input
          type="range"
          min="1"
          max="5"
          step="0.5"
          value={String(props.config.strokeWidth ?? 2.5)}
          onInput={(event) => props.onPatch({ strokeWidth: Number(event.currentTarget.value) })}
        />
      </LabelFieldRow>
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
