import type { DashboardWidgetDoc } from "./dashboardStore";
import { widgetRegistry } from "../../widgets/widgetRegistry";

export type WidgetRuntimeStatus = "live" | "fallback" | "error" | "static";
export type WidgetRuntimeResult = {
  value: string;
  status: WidgetRuntimeStatus;
};

function readFieldFromPayload(payload: unknown, field: string): unknown {
  if (!field) return payload;
  const tokens = field.split(".").filter(Boolean);
  let current: unknown = payload;
  for (const token of tokens) {
    if (!current || typeof current !== "object" || !(token in (current as Record<string, unknown>))) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[token];
  }
  return current;
}

function coerceToString(value: unknown, fallback: string): string {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return fallback;
  }
}

export function getWidgetGroupKey(widget: DashboardWidgetDoc): string {
  const group = widgetRegistry[widget.type].getUpdateGroup(widget.config as any);
  return group || `__widget__${widget.id}`;
}

export type WidgetFetchTimeRange = { fromMs: number; toMs: number };

function endpointWithTimeRange(
  endpoint: string,
  timeRange: WidgetFetchTimeRange | undefined
): string {
  if (!timeRange) return endpoint;
  try {
    const u = new URL(endpoint, window.location.origin);
    u.searchParams.set("from", new Date(timeRange.fromMs).toISOString());
    u.searchParams.set("to", new Date(timeRange.toMs).toISOString());
    return u.toString();
  } catch {
    return endpoint;
  }
}

/**
 * Fetches widget data. When `timeRange` is set, `from` and `to` are added as ISO8601 query parameters.
 */
export async function fetchWidgetRuntimeValue(
  widget: DashboardWidgetDoc,
  signal: AbortSignal,
  timeRange?: WidgetFetchTimeRange
): Promise<WidgetRuntimeResult> {
  const spec = widgetRegistry[widget.type].getFetchSpec(widget.config as any);
  if (!spec.enabled || !spec.endpoint) {
    const modeStatus: WidgetRuntimeStatus =
      (widget.config as Record<string, unknown>)?.sourceMode === "static" ? "static" : "fallback";
    return { value: spec.fallback, status: modeStatus };
  }
  try {
    const url = endpointWithTimeRange(spec.endpoint, timeRange);
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json, text/plain;q=0.9, */*;q=0.8" },
      signal
    });
    if (!response.ok) return { value: spec.fallback, status: "error" };
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const payload = (await response.json()) as unknown;
      const raw = readFieldFromPayload(payload, spec.field);
      return {
        value: coerceToString(raw, spec.fallback),
        status: raw === undefined || raw === null ? "fallback" : "live"
      };
    }
    const text = await response.text();
    if (!spec.field) {
      return { value: text || spec.fallback, status: text ? "live" : "fallback" };
    }
    try {
      const parsed = JSON.parse(text) as unknown;
      const raw = readFieldFromPayload(parsed, spec.field);
      return {
        value: coerceToString(raw, spec.fallback),
        status: raw === undefined || raw === null ? "fallback" : "live"
      };
    } catch {
      return { value: text || spec.fallback, status: text ? "live" : "fallback" };
    }
  } catch {
    return { value: spec.fallback, status: "error" };
  }
}
