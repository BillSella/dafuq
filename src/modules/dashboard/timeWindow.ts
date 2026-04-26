export const TIME_WINDOW_STORAGE_KEY = "dafuq:timeWindow";

/**
 * Dashboard time-window state model and storage helpers.
 *
 * State modification contract:
 * - Source of truth: caller-owned `TimeWindowState` passed into helper functions.
 * - Mutation paths:
 *   - `loadTimeWindowFromStorage` hydrates state from localStorage with validation.
 *   - `saveTimeWindowToStorage` persists caller-owned state.
 * - Guard behavior: invalid or unreadable storage payloads always fall back
 *   to `defaultTimeWindow()` to keep UI state recoverable.
 */

export type RelativePresetId =
  | "last1h"
  | "last4h"
  | "last1d"
  | "last3d"
  | "last7d"
  | "last1mo"
  | "last3mo"
  | "last1y";

export type TimeWindowState =
  | { kind: "relative"; preset: RelativePresetId }
  | { kind: "absolute"; fromMs: number; toMs: number };

const H = 3600000;
const D = 24 * H;

export const RELATIVE_PRESETS: ReadonlyArray<{
  id: RelativePresetId;
  label: string;
  buttonLabel: string;
  durationMs: number;
}> = [
  { id: "last1h", label: "Last 1 Hour", buttonLabel: "1 Hour", durationMs: H },
  { id: "last4h", label: "Last 4 Hours", buttonLabel: "4 Hours", durationMs: 4 * H },
  { id: "last1d", label: "Last 1 Day", buttonLabel: "1 Day", durationMs: D },
  { id: "last3d", label: "Last 3 Days", buttonLabel: "3 Days", durationMs: 3 * D },
  { id: "last7d", label: "Last 7 Days", buttonLabel: "7 Days", durationMs: 7 * D },
  { id: "last1mo", label: "Last 1 Month", buttonLabel: "1 Month", durationMs: 30 * D },
  { id: "last3mo", label: "Last 3 Months", buttonLabel: "3 Months", durationMs: 90 * D },
  { id: "last1y", label: "Last 1 Year", buttonLabel: "1 Year", durationMs: 365 * D }
];

/**
 * Returns the canonical initial time window state.
 */
export function defaultTimeWindow(): TimeWindowState {
  return { kind: "relative", preset: "last1h" };
}

/**
 * Resolves a state model into concrete from/to timestamps.
 *
 * @param state Relative or absolute time-window state.
 * @param nowMs Reference "now" used for relative windows.
 * @returns Normalized range where `fromMs <= toMs`.
 */
export function resolveTimeRange(
  state: TimeWindowState,
  nowMs: number = Date.now()
): { fromMs: number; toMs: number } {
  if (state.kind === "absolute") {
    const lo = Math.min(state.fromMs, state.toMs);
    const hi = Math.max(state.fromMs, state.toMs);
    return { fromMs: lo, toMs: hi };
  }
  const preset = RELATIVE_PRESETS.find((p) => p.id === state.preset);
  const durationMs = preset?.durationMs ?? H;
  return { fromMs: nowMs - durationMs, toMs: nowMs };
}

/**
 * Returns short button text for the current time-window state.
 */
export function timeWindowButtonLabel(state: TimeWindowState): string {
  if (state.kind === "relative") {
    return RELATIVE_PRESETS.find((p) => p.id === state.preset)?.buttonLabel ?? "Time";
  }
  return "Custom";
}

/**
 * Returns a human-readable summary label for the current time-window state.
 */
export function timeWindowSummaryLabel(state: TimeWindowState, nowMs: number = Date.now()): string {
  if (state.kind === "relative") {
    return RELATIVE_PRESETS.find((p) => p.id === state.preset)?.label ?? "Time range";
  }
  const { fromMs, toMs } = resolveTimeRange(state, nowMs);
  return `${new Date(fromMs).toLocaleString()} – ${new Date(toMs).toLocaleString()}`;
}

/**
 * Validates whether a string maps to a known relative preset id.
 */
export function isValidRelativePreset(id: string): id is RelativePresetId {
  return RELATIVE_PRESETS.some((p) => p.id === id);
}

/**
 * Loads and validates persisted time-window state from localStorage.
 *
 * Falls back to the default state on missing, malformed, or invalid data.
 */
export function loadTimeWindowFromStorage(): TimeWindowState {
  try {
    const raw = localStorage.getItem(TIME_WINDOW_STORAGE_KEY);
    if (!raw) return defaultTimeWindow();
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return defaultTimeWindow();
    const o = parsed as Record<string, unknown>;
    if (o.kind === "relative" && typeof o.preset === "string" && isValidRelativePreset(o.preset)) {
      return { kind: "relative", preset: o.preset };
    }
    if (
      o.kind === "absolute" &&
      typeof o.fromMs === "number" &&
      typeof o.toMs === "number" &&
      Number.isFinite(o.fromMs) &&
      Number.isFinite(o.toMs)
    ) {
      return { kind: "absolute", fromMs: o.fromMs, toMs: o.toMs };
    }
  } catch {
    /* ignore */
  }
  return defaultTimeWindow();
}

/**
 * Persists time-window state to localStorage.
 *
 * Storage failures are ignored to avoid blocking UI flows in restricted environments.
 */
export function saveTimeWindowToStorage(state: TimeWindowState): void {
  try {
    localStorage.setItem(TIME_WINDOW_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

/** `datetime-local` value in local timezone from ms. */
export function toDateTimeLocalValue(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Parses a `datetime-local` input value into epoch milliseconds.
 *
 * @returns `null` when input is empty or cannot be parsed.
 */
export function fromDateTimeLocalValue(value: string): number | null {
  if (!value.trim()) return null;
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? t : null;
}
