import { BaseWidget, type WidgetState } from "./baseWidget";

/**
 * Shared parsing and numeric-formatting helpers for chart-like widgets.
 *
 * State modification contract:
 * - Extends immutable `BaseWidget` without owning external state.
 * - Parses `defaultValue` payloads into normalized numeric series snapshots.
 * - Provides deterministic number formatting for compact/full display modes.
 */
export type NumberFormat = "full" | "compact";

export type ParsedChartDatum = {
  label: string;
  value: number;
};

const SUFFIXES = ["", "k", "m", "b", "t"];

export abstract class BaseChartWidget<
  TType extends string,
  TConfig extends { defaultValue: string; format: NumberFormat }
> extends BaseWidget<TType, TConfig> {
  protected constructor(state: WidgetState<TType, TConfig>) {
    super(state);
  }

  protected safeToFinite(value: number, fallback: number): number {
    return Number.isFinite(value) ? value : fallback;
  }

  protected formatNumber(value: number, format: NumberFormat, decimals: number): string {
    return format === "full"
      ? new Intl.NumberFormat("en-US", {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals
        }).format(value)
      : this.formatWithSuffix(value, decimals);
  }

  protected getDefaultValueInput(): unknown {
    const raw = (this.config.defaultValue ?? "").trim();
    if (!raw) return [];
    if (raw.startsWith("[") || raw.startsWith("{")) {
      try {
        return JSON.parse(raw) as unknown;
      } catch {
        return raw;
      }
    }
    if (raw.includes(",")) {
      return raw
        .split(",")
        .map((token) => token.trim())
        .filter(Boolean)
        .map((token) => Number(token));
    }
    return Number(raw);
  }

  protected parseSeriesData(labelField: string, valueField: string): ParsedChartDatum[] {
    const source = this.getDefaultValueInput();
    const labelKey = (labelField ?? "").trim();
    const valueKey = (valueField ?? "").trim();

    const toDatum = (label: string, rawValue: unknown, index: number): ParsedChartDatum | null => {
      const value = Number(rawValue);
      if (!Number.isFinite(value)) return null;
      return {
        label: label || `Item ${index + 1}`,
        value
      };
    };

    const fromArray = (items: unknown[]): ParsedChartDatum[] =>
      items
        .map((item, index) => {
          if (typeof item === "number") return toDatum("", item, index);
          if (typeof item === "string") return toDatum("", Number(item), index);
          if (item && typeof item === "object") {
            const record = item as Record<string, unknown>;
            const rawLabel =
              (labelKey && record[labelKey] != null ? String(record[labelKey]) : "") ||
              (record.label != null ? String(record.label) : "") ||
              (record.name != null ? String(record.name) : "");
            const rawValue =
              (valueKey && record[valueKey] != null ? record[valueKey] : undefined) ??
              record.value ??
              record.y ??
              record.amount;
            return toDatum(rawLabel, rawValue, index);
          }
          return null;
        })
        .filter((datum): datum is ParsedChartDatum => !!datum);

    if (Array.isArray(source)) {
      return fromArray(source);
    }
    if (source && typeof source === "object") {
      const record = source as Record<string, unknown>;
      const arrayLike = Object.values(record).find((value) => Array.isArray(value));
      if (Array.isArray(arrayLike)) {
        const parsed = fromArray(arrayLike);
        if (parsed.length > 0) return parsed;
      }
    }
    const single = toDatum("", source, 0);
    return single ? [single] : [];
  }

  private formatWithSuffix(value: number, decimals: number): string {
    if (value === 0) return `0${decimals > 0 ? `.${"0".repeat(decimals)}` : ""}`;
    const sign = value < 0 ? "-" : "";
    const absolute = Math.abs(value);
    const exponent = Math.min(Math.floor(Math.log10(absolute) / 3), SUFFIXES.length - 1);
    const scaled = absolute / 10 ** (exponent * 3);
    return `${sign}${scaled.toFixed(decimals)}${SUFFIXES[exponent]}`;
  }
}
