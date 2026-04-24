import type { NumberFormat } from "../../widgets/baseChartWidget";
import { PillSelector } from "../ui/PillSelector";

type FormatDecimalsFieldsProps = {
  format: NumberFormat;
  decimals: 0 | 1 | 2 | 3;
  formatAriaLabel: string;
  decimalsAriaLabel: string;
  formatClass?: string;
  onFormatChange: (value: NumberFormat) => void;
  onDecimalsChange: (value: 0 | 1 | 2 | 3) => void;
};

export function FormatDecimalsFields(props: FormatDecimalsFieldsProps) {
  return (
    <>
      <fieldset class={`field fieldset ${props.formatClass ?? ""}`.trim()}>
        <span>Format</span>
        <PillSelector
          ariaLabel={props.formatAriaLabel}
          selected={props.format}
          options={[
            { value: "full", label: "Full" },
            { value: "compact", label: "Compact" }
          ]}
          onSelect={(option) => props.onFormatChange(option)}
        />
      </fieldset>
      <fieldset class="field fieldset">
        <span>Decimals</span>
        <PillSelector
          ariaLabel={props.decimalsAriaLabel}
          selected={props.decimals}
          options={[
            { value: 0, label: "0" },
            { value: 1, label: "1" },
            { value: 2, label: "2" },
            { value: 3, label: "3" }
          ]}
          onSelect={(option) => props.onDecimalsChange(option)}
        />
      </fieldset>
    </>
  );
}
