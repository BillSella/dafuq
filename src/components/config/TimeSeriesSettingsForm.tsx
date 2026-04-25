import type { TimeSeriesConfig } from "../../widgets/timeSeriesWidget";
import type { JSX } from "solid-js";
import { ApiSettingsSection } from "./ApiSettingsSection";
import { ApiConnectionFields } from "./ApiConnectionFields";
import { FormatDecimalsFields } from "./FormatDecimalsFields";
import { TogglePillField } from "./TogglePillField";
import { LabelFieldRow } from "../ui/LabelFieldRow";

type TimeSeriesSettingsFormProps = {
  config: TimeSeriesConfig;
  dashboardUpdateGroups: string[];
  onPatch: (patch: Partial<TimeSeriesConfig>) => void;
  baseSettings: JSX.Element;
};

/**
 * Time-series chart configuration form with stacking/grid/fill controls.
 *
 * State modification contract:
 * - Source of truth: parent-controlled `config`.
 * - Mutation path: emits partial time-series config patches through `onPatch`.
 * - Composes shared format, toggle, and API settings controls.
 */
export function TimeSeriesSettingsForm(props: TimeSeriesSettingsFormProps) {
  return (
    <>
      {props.baseSettings}
      <FormatDecimalsFields
        format={props.config.format ?? "compact"}
        decimals={props.config.decimals ?? 1}
        formatAriaLabel="Time series value format"
        decimalsAriaLabel="Time series decimals"
        onFormatChange={(value) => props.onPatch({ format: value })}
        onDecimalsChange={(value) => props.onPatch({ decimals: value })}
      />
      <TogglePillField
        label="Stacked"
        ariaLabel="Time series stacked"
        value={props.config.stacked === true}
        class="section-gap-top"
        onChange={(value) => props.onPatch({ stacked: value })}
      />
      <TogglePillField
        label="Fill"
        ariaLabel="Time series area fill"
        value={props.config.showFill !== false}
        onChange={(value) => props.onPatch({ showFill: value })}
      />
      <TogglePillField
        label="Grid"
        ariaLabel="Time series grid"
        value={props.config.showGrid !== false}
        onChange={(value) => props.onPatch({ showGrid: value })}
      />
      <LabelFieldRow label="Line Width" class="section-gap-top">
        <input
          type="range"
          min="1"
          max="5"
          step="0.5"
          value={String(props.config.strokeWidth ?? 2.2)}
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
          value={props.config.max === 12 ? "" : String(props.config.max ?? "")}
          placeholder="Dynamic"
          onInput={(event) => {
            const raw = event.currentTarget.value.trim();
            if (raw === "") return;
            props.onPatch({ max: Number(raw) || 12 });
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
