import { describe, expect, it, vi, afterEach } from "vitest";
import {
  TIME_WINDOW_STORAGE_KEY,
  defaultTimeWindow,
  fromDateTimeLocalValue,
  isValidRelativePreset,
  loadTimeWindowFromStorage,
  resolveTimeRange,
  saveTimeWindowToStorage,
  timeWindowButtonLabel,
  timeWindowSummaryLabel,
  toDateTimeLocalValue
} from "./timeWindow";

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("timeWindow", () => {
  it("returns default relative window", () => {
    expect(defaultTimeWindow()).toEqual({ kind: "relative", preset: "last1h" });
  });

  it("resolves absolute ranges in sorted order", () => {
    expect(resolveTimeRange({ kind: "absolute", fromMs: 500, toMs: 100 })).toEqual({
      fromMs: 100,
      toMs: 500
    });
  });

  it("resolves relative ranges against provided now", () => {
    const now = 10_000_000;
    const range = resolveTimeRange({ kind: "relative", preset: "last4h" }, now);
    expect(range).toEqual({ fromMs: now - 4 * 3_600_000, toMs: now });
  });

  it("builds button and summary labels", () => {
    expect(timeWindowButtonLabel({ kind: "relative", preset: "last1d" })).toBe("1 Day");
    expect(timeWindowButtonLabel({ kind: "absolute", fromMs: 1, toMs: 2 })).toBe("Custom");

    const now = 1_000;
    const summary = timeWindowSummaryLabel({ kind: "relative", preset: "last1h" }, now);
    expect(summary).toBe("Last 1 Hour");
  });

  it("formats and parses datetime-local values", () => {
    const value = toDateTimeLocalValue(Date.UTC(2026, 3, 25, 16, 30));
    expect(value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);

    expect(fromDateTimeLocalValue("")).toBeNull();
    expect(fromDateTimeLocalValue("not-a-date")).toBeNull();
    expect(typeof fromDateTimeLocalValue("2026-04-25T16:30")).toBe("number");
  });

  it("validates relative presets", () => {
    expect(isValidRelativePreset("last1h")).toBe(true);
    expect(isValidRelativePreset("random")).toBe(false);
  });

  it("loads fallback for missing or malformed storage", () => {
    expect(loadTimeWindowFromStorage()).toEqual(defaultTimeWindow());

    localStorage.setItem(TIME_WINDOW_STORAGE_KEY, "{bad-json");
    expect(loadTimeWindowFromStorage()).toEqual(defaultTimeWindow());
  });

  it("loads valid relative and absolute storage payloads", () => {
    localStorage.setItem(TIME_WINDOW_STORAGE_KEY, JSON.stringify({ kind: "relative", preset: "last7d" }));
    expect(loadTimeWindowFromStorage()).toEqual({ kind: "relative", preset: "last7d" });

    localStorage.setItem(TIME_WINDOW_STORAGE_KEY, JSON.stringify({ kind: "absolute", fromMs: 10, toMs: 20 }));
    expect(loadTimeWindowFromStorage()).toEqual({ kind: "absolute", fromMs: 10, toMs: 20 });
  });

  it("saves state to storage and tolerates storage exceptions", () => {
    const state = { kind: "relative", preset: "last3mo" } as const;
    saveTimeWindowToStorage(state);
    expect(localStorage.getItem(TIME_WINDOW_STORAGE_KEY)).toBe(JSON.stringify(state));

    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => saveTimeWindowToStorage(state)).not.toThrow();
  });
});

